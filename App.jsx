import React from "react";
import ReactDOM from "react-dom/client";
import RallyWebGame from "./RallyWebGame";
import "./index.css";

function App(){
    return <RallyWebGame />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);