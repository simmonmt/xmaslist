import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./app";
//import {proto} from "../proto/list_ts_proto";

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

//let list = new proto.List();
//list.items.push(new proto.ListItem());

//console.log(list);
