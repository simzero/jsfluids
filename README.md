# jsfluids - A high-level JS module for real-time CFD inference

`jsfluids` is a high-level JavaScript module for inferring/solving fluid dynamics in real-time based on pre-constructed models. The module is also used as the interface with virtual worlds although can be used directly in a backend. The pre-constructed models are based on reduced-order models, data-driven ML or (soon) with PINNs. For ML-based models we rely on ONNX Runtime for solving the new fields and use `jsfluids` for handling inputs and results.

You can use this module locally, and we've also made it available to you on our playground at https://play.simzero.com. On the playground, you can directly play with the library and share your work. The playground is integrated into Babylon.js as the real-time 3D engine and include other tools such as ONNX and JSCAD for parametric advanced CAD modelling.

Examples for building the pre-constructed models will be soon available together with the code.

## Installation

You can install this module via npm:

```
npm install jsfluids
```

Or, you can load it as a script tag in your HTML file:

```
<script src="https://unpkg.com/jsfluids/dist/browser.js"></script>
```

This module will soon be available as an ES6 module.

## Usage

To use this module, you can require it in your Node.js code or access it via the global object in your browser code:

```
import jsfluids from 'jsfluids'
```

In any case you need to call the following before using the module:

```
(async() => {
  await jsfluids.ready;
})();
```

Once you have access to the module, you can call its functions as needed:

```
    const model = jsfluids.ML;

    model.loadMesh(meshURL).then(() => {
      ort.InferenceSession.create(onnxURL).then((onnx) => {
        // jsfluids functions
        ...
        onnx.run(feeds).then((results) => {
          // jsfluids functions
          ...
        });
      });
    });
```
or

```
    const model = jsfluids.ITHACAFV;

    model.loadMesh(meshURL).then(() => {
      model.loadModel(romURL).then(() => {
         // jsfluids functions
         ...
      });
    });
```

## Supported Packages for Pre-Constructed Models

The module supports:

- [DeepCFD](https://github.com/mdribeiro/DeepCFD)
- [ITHACA-FV](https://github.com/mathLab/ITHACA-FV) (laminar and turbulent steady-state supported as of today)

## Third-party packages

The following main open-source packages were used in this module:

- [DeepCFD](https://github.com/mdribeiro/DeepCFD)
- [Eigen](https://eigen.tuxfamily.org)
- [Emscripten](https://emscripten.org)
- [ITHACA-FV](https://github.com/mathLab/ITHACA-FV)
- [ONNX Runtime](https://onnxruntime.ai)
- [OpenFOAM](https://www.openfoam.com)
- [VTK](https://vtk.org)


## Disclaimer

This offering is not approved or endorsed by OpenCFD Limited, producer and distributor of the OpenFOAM software via www.openfoam.com, and owner of the OPENFOAM® and OpenCFD® trade marks. This offering is not approved or endorsed by any software packages mentioned above or their respective owners, and should not be considered as such.

## Release Candidate

This version of the module is a release candidate and is not yet considered stable. Please use with caution and report any issues you encounter.

## License

The jsfluids repository is licensed under the MIT License. The MIT License is a permissive open-source software license that allows users to freely use, modify, and distribute the licensed software for any purpose, without requiring payment or attribution to the original authors. The license also includes a warranty disclaimer, limiting the liability of the authors for any damages resulting from the use of the software.

A JS module is built from this source code and deployed to the public npm registry as jsfluids. The module is licensed under MIT but it's also bundled with `@simzero/rom.js` for using `ITHACA-FV` models. `rom.js` is licensed under LGPL as a derivative work of [ITHACA-FV](https://github.com/ITHACA-FV/ITHACA-FV) developed and maintained at the University of Urbino Carlo Bo by Dr. Giovanni Stabile and at SISSA mathLab in collaboration with Prof. Gianluigi Rozza's group. In jsfluids, the `ITHACAFV` class is a separate and independent chunk that is dynamically loaded only when calling the class `jsfluids.ITHACAFV`. This LGPL module is subject to the terms of the GNU Lesser General Public License (LGPL), which is also a permissive open-source software license, but with some additional restrictions on the distribution of derivative works. Users who use the LGPL module in conjunction with the MIT-licensed module must comply with the LGPL's requirements for attribution, source code distribution, and compatibility with other software.
