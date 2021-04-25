import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./app";
import { EchoRequest } from "./echo_pb";

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

let foo = new EchoRequest();
console.log(foo);
