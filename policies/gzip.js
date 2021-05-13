var zlib = require('zlib')
var onHeaders = require('on-headers')
var accepts = require('accepts')
var compressible = require('compressible')
module.exports = {
  name: 'gzip',
  schema: {
    $id: 'express-gateway-plugin-gzip',
    type: 'object',
    properties: {
      level: {
        tpye: 'integer'
      }
    },
    required: ['level']
  },
  policy: (actionParams) => {
    const that = this;
    return (req, res, next) => {
      var accept = accepts(req)
      var method = accept.encoding(['gzip', 'deflate', 'identity'])
      if (method == 'gzip') {
        var stream
        var ended = false
        var listeners = []
        var _end = res.end
        var _on = res.on
        var _write = res.write

        res.flush = function flush () {
          if (stream) {
            stream.flush()
          }
        }

        res.write = function write (chunk, encoding) {
          // console.log('write')
          if (ended) {
            return false
          }
    
          if (!this._header) {
            this._implicitHeader()
          }
    
          return stream
            ? stream.write(toBuffer(chunk, encoding))
            : _write.call(this, chunk, encoding)
        }

        res.end = function end (chunk, encoding) {
          // console.log('res end1')
          if (ended) {
            return false
          }
          // console.log('res end2')
          if (!this._header) {
            // estimate the length
            if (!this.getHeader('Content-Length')) {
              length = chunkLength(chunk, encoding)
            }
    
            this._implicitHeader()
          }
          // console.log('res end3')
          // console.log(stream)
          if (!stream) {
            return _end.call(this, chunk, encoding)
          }
          // console.log('res end4')
          // mark ended
          ended = true
    
          // write Buffer for Node.js 0.8
          return chunk
            ? stream.end(toBuffer(chunk, encoding))
            : stream.end()
        }

        res.on = function on (type, listener) {
          // console.log('res on1', 'type:', type)
          if (!listeners || type !== 'drain') {
            return _on.call(this, type, listener)
          }
          // console.log('res on2')
          if (stream) {
            return stream.on(type, listener)
          }
          // console.log('res on3')
          // buffer listeners for future stream
          listeners.push([type, listener])
    
          return this
        }

        onHeaders(res, function onResponseHeaders () {
          var method = 'gzip'
          // console.log('create stream1', actionParams)
          // console.log(!shouldCompress(req, res))
          if (!shouldCompress(req, res)) {
            return
          }

          if (Number(res.getHeader('Content-Length')) < actionParams.minLength)
            return
          stream = zlib.createGzip({
            level: parseInt(actionParams.level)
          })

          addListeners(stream, stream.on, listeners)

          res.setHeader('Content-Encoding', method)
          res.removeHeader('Content-Length')

          // console.log('gzip========', res.getHeader('Expires'))
          // console.log('gzip========', res.getHeader('Cache-Control:no-cache'))
          // console.log('gzip========', res.getHeader('Cache-Control:no-store'))
          // console.log('gzip========', res.getHeader('Cache-Control:private'))
          // console.log('gzip========', res.getHeader('Authorization'))

          stream.on('data', function onStreamData (chunk) {
            // console.log('_write',chunk.toString())
            if (_write.call(res, chunk) === false) {
              stream.pause()
            }
          })
    
          stream.on('end', function onStreamEnd () {
            // console.log('stream end')
            _end.call(res)
          })

          _on.call(res, 'drain', function onResponseDrain () {
            stream.resume()
          })
        })
      }
      next()
    };
  }
};

function addListeners (stream, on, listeners) {
  for (var i = 0; i < listeners.length; i++) {
    on.apply(stream, listeners[i])
  }
}

function chunkLength (chunk, encoding) {
  if (!chunk) {
    return 0
  }

  return !Buffer.isBuffer(chunk)
    ? Buffer.byteLength(chunk, encoding)
    : chunk.length
}

function toBuffer (chunk, encoding) {
  return !Buffer.isBuffer(chunk)
    ? Buffer.from(chunk, encoding)
    : chunk
}

function shouldCompress (req, res) {
  var type = res.getHeader('Content-Type')

  if (type === undefined || !compressible(type)) {
    // debug('%s not compressible', type)
    return false
  }

  return true
}