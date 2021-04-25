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

const userService = new UserServiceClient(
  "http://nash.simmonmt.org:8081",
  null,
  null
);

let req = new LoginRequest();
req.setUsername("simmonmt");
req.setPassword("hunter2");

userService.login(req, undefined, function (err, response) {
  if (err) {
    console.log(err.code);
    console.log(err.message);
  } else {
    console.log(response);
  }
});
