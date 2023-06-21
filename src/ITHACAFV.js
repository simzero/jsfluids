// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

import ithacafv from '../build/ithacafv.js'
import wasm from '../build/ithacafv.wasm'

const Module = ithacafv({
  wasmBinary: wasm
});

ithacafv.ready = Module.then(module => {
  ithacafv["ITHACAFV"] = module["ITHACAFV"]
})

export default ithacafv
