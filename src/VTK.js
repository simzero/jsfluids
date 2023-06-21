// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

import ithacafv from '../build/vtk.js'
import wasm from '../build/vtk.wasm'

const Module = vtk({
  wasmBinary: wasm
});

vtk.ready = Module.then(module => {
  vtk["VTK"] = module["VTK"]
})

export default vtk
