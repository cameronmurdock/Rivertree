import React from "react";
import { createRoot } from "react-dom/client";
import ShiftChecklist from "./ShiftChecklist";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<ShiftChecklist />);
