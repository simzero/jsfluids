// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

import ml from '../build/ml.js'
import wasm from '../build/ml.wasm'

const Module = ml({
  wasmBinary: wasm
});

ml.ready = Module.then(module => {
  ml["ML"] = module["ML"]
})

export default ml
