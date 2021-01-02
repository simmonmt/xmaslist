import * as React from "react";
import * as ReactDOM from "react-dom";
import * as styles from "./styles.css";
import * as test from "./test";

ReactDOM.render(
  <h1 className={styles.h1}>{test.GetText()}</h1>,
  document.getElementById("root")
);
