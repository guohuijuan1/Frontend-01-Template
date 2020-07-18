var parser = require('./parser(2)')

module.exports = function(source, map) {
  console.log(source)
  console.log('----------------my loader start -------------------->')
  const data = this.resourcePath.split('\\');
  const className = data[data.length - 1].replace('.vue', '')
  const tree = parser.parseHTML(source)
  let template = null;
  let script = null;
  for(let node of tree.children) {
    if(node.tagName === 'template') {
      template = node;
    }
    if (node.tagName === 'script') {
      script = node.children[0].content;
    }
  }

  const visit = (node) => {
    if (node.type === 'text') {
      return JSON.stringify(node.content);
    }
    for(let i = 0; i < node.children.length; i++) {
      let attrs = {};
      for(let attr of node.attributes) {
        if(!['type', 'tagName'].includes(attr.name)) {
          attrs[attr.name] = attr.value;
        }
      }
      let children = node.children.map(node => visit(node))
      return `create("${node.tagName}", ${JSON.stringify(attrs)}, ${children})`
    }
  }
  const r = `
import {create, Wrapper, Text} from './creatElement.js'
export class ${className} {
  mountTo(parent){
    parent.appendChild(this.root);
  }
  render() {
    return ${visit(template)}
  }
}
`
  console.log(r)
  console.log('----------------my loader end -------------------->')
  return r;
}

