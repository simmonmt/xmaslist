import * as React from "react";
import * as ReactDOM from "react-dom";
import { UserServiceClient } from "../proto/user_service_grpc_web_pb";
import { LoginRequest } from "../proto/user_service_pb";
import App from "./app";

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

let req = new LoginRequest();
console.log(req);

const userService = new UserServiceClient(
  "http://nash.simmonmt.org:8080",
  null,
  null
);
console.log(userService);
