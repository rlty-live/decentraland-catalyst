const json = require("rollup-plugin-json");
import npm from "@rollup/plugin-node-resolve";
import ts from "@wessberg/rollup-plugin-ts";
import commonjs from "@rollup/plugin-commonjs";
import globals from "rollup-plugin-node-globals";

const allExternals = [];

export default {
  external: allExternals,
  output: {
    name: "bundle"
  },
  plugins: [json(), npm({ preferBuiltins: true, browser: true }), commonjs({ browser: true }), globals(), , ts({})]
};