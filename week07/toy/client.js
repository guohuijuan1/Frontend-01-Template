const net = require("net")
const parser = require('./parser')
// const images = require("images");
// const render = require("./render")

class Request {
  constructor({
    host,
    port = 80,
    path = '/',
    method = 'GET',
    headers,
    body = {},
  }) {
    if (!host) {
      throw (new Error('has no host'))
    }
    this.method = method;
    this.host = host;
    this.port = port,
    this.path = path;
    const {
      ['Content-Type']: contentType = 'application/x-www-form-urlencoded',
    } = headers;
    switch (contentType) {
      case 'application/x-www-form-urlencoded': {
        this.bodyText = Object.keys(body).map(key => `${key}=${encodeURIComponent(body[key])}`).join('&')
        break;
      }
      // case 'multipart/form-data': {
      //   break;
      // }
      // case 'text/html': {
      //   break;
      // }
      case 'application/json': {
        this.bodyText = JSON.stringify(body)
        break;
      }
      default: this.bodyText = '';
    }
    this.headers = {
      ['Content-Type']: 'application/x-www-form-urlencoded',
      ...headers,
      ['Content-Length']: this.bodyText.length,
    };
  }
  toString() {
    return `${this.method} ${this.path} HTTP/1.1
${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join('\r\n')}\r
\r
${this.bodyText}`
  }
  send(connection) {
    return new Promise((resolve, reject) => {
      const resPar = new ResponseParse();
      if (connection) {
        connection.write(this.toString())
      } else {
        connection = net.createConnection({
          host: this.host,
          port: this.port,
        }, () => {
          connection.write(this.toString());
        });
      }
      connection.on('data', (data) => {
        resPar.receive(data.toString())
        // console.log('--------------')
        // console.log('statusLine', resPar.statusLine)
        // console.log('headers', resPar.headers)
        // console.log('--------------')
        if(resPar.getIsFinished()) {
          resolve(resPar.getResponse())
        }
        // resolve(data.toString());
        connection.end();
      });
      connection.on('error', (error) => {
        reject(error);
        connection.end();
      });
    })
    
  }
}

class Response {

}

class ResponseParse {
  constructor() {
    this.WAITING_STATUS_LINE = 0;
    this.WAITING_STATUS_LINE_END = 1;
    this.WAITING_HEADER_NAME = 2;
    this.WAITING_HEADER_SPACE = 3
    this.WAITING_HEADER_VALUE = 4;
    this.WAITING_HEADER_LINE_END = 5;
    this.WAITING_HEADER_BLOCK_END = 6;
    this.WAITING_BODY = 7;
  
    this.curStatus = this.WAITING_STATUS_LINE;
    this.statusLine = '';
    this.headers = {};
    this.headerName = '';
    this.headerValue = '';

    this.bodyPaser = null;
  }
  receive(string){
    for (let i = 0; i < string.length; i ++) {
      // console.log('charAt==', string.charAt(i))
      this.receiveChar(string.charAt(i))
    }
  }
  getIsFinished() {
    return this.bodyPaser &&  this.bodyPaser.finish;
  }
  getResponse(){
    this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/)
    return ({
      statusCode: RegExp.$1,
      statusText: RegExp.$2,
      headers: this.headers,
      body: this.bodyPaser.content.join('')
    })
  }
  receiveChar(char) {
    switch (this.curStatus) {
      case this.WAITING_STATUS_LINE: {
        if (char === '\r') {
          this.curStatus = this.WAITING_STATUS_LINE_END;
        } else if (char === '\n') {
          this.curStatus = this.WAITING_HEADER_NAME;
        } else {
          this.statusLine += char;
        }
        break;
      }
      case this.WAITING_STATUS_LINE_END: {
        if (char === '\n') {
          this.curStatus = this.WAITING_HEADER_NAME;
        }
        break;
      }
      case this.WAITING_HEADER_NAME: {
        if (char === ':') {
          this.curStatus = this.WAITING_HEADER_SPACE;
        } else if (char === '\r') {
          this.curStatus = this.WAITING_HEADER_BLOCK_END;
        } else {
          this.headerName += char;
        }
        break;
      }
      case this.WAITING_HEADER_SPACE: {
        if (char === ' ') {
          this.curStatus = this.WAITING_HEADER_VALUE;
        }
        break;
      }
      case this.WAITING_HEADER_VALUE: {
        if (char === '\r') {
          this.curStatus = this.WAITING_HEADER_LINE_END;
          this.headers[this.headerName] = this.headerValue;
          this.headerName = '';
          this.headerValue = '';
        } else {
          this.headerValue += char;
        }
        break;
      }
      case this.WAITING_HEADER_LINE_END: {
        if (char === '\n') {
          this.curStatus = this.WAITING_HEADER_NAME;
        }
        break;
      }
      case this.WAITING_HEADER_BLOCK_END: {
        if (char === '\n') {
          this.curStatus = this.WAITING_BODY;
          this.bodyPaser = new TrunkedBodyParse(this.headers['Transfer-Encoding'])
        }
        break;
      }
      case this.WAITING_BODY: {
        // this.bodyPaser = new TrunkedBodyParse(this.headers['Transfer-Encoding'])
        this.bodyPaser.receiveChar(char)
        // console.log('bodyPaser.content', this.bodyPaser.content)
      }
      default: break;
    }
  }
}

class TrunkedBodyParse {
  constructor(type) {
    this.type = type;
    switch (type) {
      case 'chunked': {
        this.WAINTING_LENGTH = 0;
        this.WAINTING_LENGTH_LINE_END = 1;
        this.READING_CHUNK = 2;
        this.WAITING_NEW_LINE = 3;
        this.WAITING_NEW_LINE_END = 4;

        this.curStatus = this.WAINTING_LENGTH;
        this.length = 0;
        this.finish = false;
        this.content = [];
      }
      default: break;
    }
  }

  receiveChar(char){
    // console.log(this.curStatus, JSON.stringify(char))
    switch (this.type) {
      case 'chunked': {
        switch (this.curStatus) {
          case this.WAINTING_LENGTH: {
            if (char === '\r') {
              if (this.length === 0) {
                this.finish = true;
                break;
              }
              this.curStatus = this.WAINTING_LENGTH_LINE_END;
            } else {
              this.length *= 16;
              this.length += parseInt(char, 16)
              // console.log('this.length', char, this.length)
            }
            break;
          }
          case this.WAINTING_LENGTH_LINE_END: {
            if (char === '\n') {
              this.curStatus = this.READING_CHUNK;
            }
            break;
          }
          case this.READING_CHUNK: {
            this.content.push(char);
            this.length --;
            if (this.length === 0) {
              this.curStatus = this.WAITING_NEW_LINE;
            }
            break;
          }
          case this.WAITING_NEW_LINE: {
            if (char === '\r') {
              this.curStatus = this.WAITING_NEW_LINE_END;
            }
            break;
          }
          case this.WAITING_NEW_LINE_END: {
            if (char === '\n') {
              this.curStatus = this.WAINTING_LENGTH;
            }
            break;
          }
          default: break;
        }
        break;
      }
      default: break
    }
  }
}

void async function() {
  let req = new Request({
    method: 'POST',
    host: '127.0.0.1',
    port: 8080,
    headers: {
      ['foo-5']: 5,
    },
    body: {
      name: 'ghj',
    },
  })
  // console.log(req.toString())
  const res = await req.send();

  // console.log(res)
  const dom = parser.parserHTML(res.body)

  // let viewPort = images(800,600)
  // render(viewPort, dom.children[0].children[3].children[1].children[3])

  // viewPort.save('vp.jpg')
  console.log(dom)
} ()
  


// net.connect({
//   host: 'localhost',
//   port: 8080,
//   onread: {
//     // Reuses a 4KiB Buffer for every read from the socket.
//     buffer: Buffer.alloc(4 * 1024),
//     callback: function(nread, buf) {
//       // Received data is available in `buf` from 0 to `nread`.
//       console.log(buf.toString('utf8', 0, nread));
//     }
//   }
// });

// const client = net.createConnection({
//   host: 'localhost',
//   port: 8080,
// }, () => {
//   // 'connect' listener.
//   console.log('connected to server!');
//   client.write(req.toString());
// });

// client.on('data', (data) => {
//   console.log(data.toString());
//   client.end();
// });
// client.on('end', () => {
//   console.log('disconnected from server');
// });

// client.on('error', (error) => {
//   console.log('error', error);
//   client.end();
// });