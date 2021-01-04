import * as React from "react";
import { BrowserRouter as Router, Link, Route, Switch } from "react-router-dom";
import { WishList } from "./wishlist";

function App() {
  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/view">View</Link>
            </li>
          </ul>
        </nav>

        <Switch>
          <Route path="/view">
            <WishList />
          </Route>
          <Route path="/">
            <Home />
          </Route>
        </Switch>
      </div>
    </Router>
  );
}

function Home() {
  return <h2>Home</h2>;
}

export default App;
