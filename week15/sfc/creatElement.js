export function create(Cls, attributes, ...children){
    
  let o;

  if(typeof Cls === "string") {
      o = new Wrapper(Cls);
  } else {
      o = new Cls({
          timer: {}
      });
  }
  for(let name in attributes) {
    console.log(o)
    o.setAttribute(name, attributes[name]);
  }

  let visit = function (children) {
    for(let child of children) {
      if(typeof child === "object" && child instanceof Array) {
        visit(child);
        continue;
      }
      if(typeof child === "string") {
        child = new Text(child);
      }
      o.appendChild(child);
    }
  }

  visit(children)
  return o;
}

export class Text {
  constructor(text){
      this.children = [];
      this.root = document.createTextNode(text);
  }
  mountTo(parent){
      parent.appendChild(this.root);
  }
}

export class Wrapper{
  constructor(type){
      this.children = [];
      this.root = document.createElement(type);
      console.log(this.root)
  }

  setAttribute(name, value) { //attribute
      this.root.setAttribute(name, value);
  }

  appendChild(child){
      this.children.push(child);

  }
  addEventListener(...val){
    this.root.addEventListener(...val)
  }

  mountTo(parent){
      parent.appendChild(this.root);

      for(let child of this.children){
          child.mountTo(this.root);
      }
  }
  get style() {
    return this.root.style;
  }
}