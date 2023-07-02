// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

import Papa from 'papaparse'
import { Buffer } from 'buffer'
import jszip from 'jszip'
import axios from 'axios'
import emscriptenModule from '../build/jsfluids.js'
import wasm from '../build/jsfluids.wasm'


let ithacafv;
let ml;

let jsfluids = {};

const readFile = async (zipFiles, filename) => {
  try {
    // Get the file from the zip archive
    const item = zipFiles.files[filename];

    // Create a buffer from the file data
    const buffer = await item.async('arraybuffer');

    // Decode the buffer using TextDecoder
    const decoder = new TextDecoder();
    const csvData = decoder.decode(buffer);

    // Parse the CSV data using Papa.parse
    const { data } = Papa.parse(csvData, {
      delimiter: ' ',
      dynamicTyping: true,
      skipEmptyLines: true,
      header: false,
    });

    // Transpose the data array
    const transposed = data[0].map((col, i) => data.map(row => row[i]));

    // Return a Promise that resolves with the transposed data, number of rows, and number of columns
    return Promise.resolve([
      Float64Array.from(
        transposed.flat()
      ),
      data.length,
      data[0].length
    ]);
  } catch (err) {
    // Handle errors
    console.error(err);
    return Promise.reject(err);
  }
};

const Module = emscriptenModule({
  wasmBinary: wasm
});

class VTKFunctions {
  grid(instance) {
    return instance.exportUnstructuredGrid();
  }

  setComponent(dict, instance) {
    switch (dict.component) {
      case 'surface':
        instance.geometry();
        return instance.exporter();
      break;
      case 'plane':
        instance.plane(
          dict.planeProperties.origin[0],
          dict.planeProperties.origin[1],
          dict.planeProperties.origin[2],
          dict.planeProperties.normal[0],
          dict.planeProperties.normal[1],
          dict.planeProperties.normal[2]
	);

        return instance.exporter();
      break;
      case 'streamlines':
        instance.streams(
          dict.streamlinesProperties.center[0],
          dict.streamlinesProperties.center[1],
          dict.streamlinesProperties.center[2],
          dict.streamlinesProperties.radius,
          dict.streamlinesProperties.propagation,
          dict.streamlinesProperties.tubeRadius,
          dict.streamlinesProperties.tubeSides,
          dict.streamlinesProperties.resolution,
          dict.streamlinesProperties.field
        );

        return instance.exporter();
      break;
      default:
        throw new Error('Invalid component name. Only surface, plane and '
          + 'streamlines are currently supported.');
      break;
    }
  }

  operations(instance, operations) {
    for (var i = 0; i < operations.length; i++) {
      switch (operations[i]) {
        case 'vorticity':
          instance.gradients(true, false);
        break;
        case 'gradients':
          instance.gradients(false, true)
        break;
        case 'gradients' && 'vorticity':
          instance.gradients(true, true)
        break;
        default:
          throw new Error('Invalid operation. Only vorticity currently supported.');
        break;
      }
    }
  }

  integrate(instance, dict) {
    var values = instance.integrate(dict.field, dict.target);

    if (values.length === 2) {
      return {
        extent: values[0],
        sum: [values[1], values[2]]
      }
    }
    else {
      return {
        extent: values[0],
        sum: [values[1], values[2], values[3], values[4]]
      }
    }
  }

  probe(instance, dict) {
    return instance.probe(dict.field, dict.point[0], dict.point[1], dict.point[2]);
  }

  render(component, dict, instance) {
    instance.removeAllActors();

    var componentIndex = -1;

    if ('index' in dict) {
      componentIndex = dict.index;
    }

    if (dict.range) {
      return {
        colors: instance.render(
          component,
          dict.field,
          componentIndex,
          dict.range[0],
          dict.range[1]
        ),
        range: dict.range
      };
    } else {
      return {
        colors: instance.render(component, dict.field, componentIndex, 0, 0),
        range: instance.scalarBarRange(componentIndex)
      };
    }
  }
}

/**
 * Class for dealing with data from ML models. You need
 * a VTK Unstructured Grid (.vtu) and an ONNX model. ONNX models can be
 * converted from several ML frameworks. See
 * {@link https://github.com/simzero/cfdonnx} for more details.
 * ```
 * var model = jsfluids.ML;
 * ```
 * @class
 * @alias jsfluids.ML
 * @memberof jsfluids
 * @description This is the ML class.
 */
class MLWrapper extends VTKFunctions {
  /**
   * Creates a new MLWrapper object
   * @hideconstructor
   */
  constructor() {
    super();

    this.component = "surface";
    this.fieldName = "U";
    this.nComponents = "1";
    this.nCells = "0";
    this.operations = [];
  }

  async init() {
    const mlModule = await import(/* webpackChunkName: "ml" */ "./ML.js");
    const ml = mlModule.default;
    await ml.ready;
    this.ml = new ml.ML();
  }

  /**
   * Loads a VTK Unstructured Grid (.vtu) mesh from either an URL or a buffer.
   *
   * This function initialize the module and the scene, and sets the number
   * of cells.
   *
   * @example
   * model.loadMesh(meshURL).then(() => {
   *   ...
   * });
   * @param {Buffer|TypedArray|string} mesh - The mesh to load, which can be either an URL
   * or a buffer of a VTU file:
   * - If mesh is a buffer, the mesh will be loaded from the buffer.
   * - If mesh is a TypedArray, the mesh will be decoded from UTF-8 to a string.
   * - If mesh is a string, it is treated as an URL and the mesh will be loaded
   *   from the URL.
   */
  async loadMesh(mesh) {
    await this.init();
    if (Buffer.isBuffer(mesh)) {
      this.nCells = this.ml.readUnstructuredGrid(mesh);
    } else if (ArrayBuffer.isView(mesh)) {
      const decoder = new TextDecoder('utf-8');
      const meshString = decoder.decode(mesh);
      this.nCells = this.ml.readUnstructuredGrid(meshString);
    } else if (typeof mesh === 'string') {
      const response = await axios.get(mesh);
      this.nCells = this.ml.readUnstructuredGrid(response.data);
    } else {
      throw new Error('Invalid input type. Must be either a'
        + ' Buffer or a URL string.');
    }
    this.ml.initScene();
  }

  /**
   * Computes the signed distance field (SDF) and flow region fields on the
   * grid based on an STL.
   * <ul>
   *   <li>It assumes the grid has a SDF2 field with the SDF from the top/bottom
   *   surfaces and flowRegion with inlet, outlet and walls.<li>
   *   <li>It creates a new SDF1 field with the SDF from the walls defined
   *   from the STL.<li>
   *   <li>It modifies the flowRegion field to label the field inside the STL with 0.<li>
   * </ul>
   *
   * Note: This function is optional and specifically designed for DeepCFD.
   * @example
   * var sdf = model.SDFAndRegion(stlBuffer);
   * @param {Buffer} buffer - The STL buffer
   * @returns {Float64Array} The array with fields SDF1, flowRegion and SDF2.
   */
  SDFAndRegion(geometry) {
    var vtk = this.ml.stlToVtp(geometry);

    return this.ml.computeSDFAndRegion(vtk);
  }

  /**
   * Updates the fields in the loaded grid and applies the operations defined
   * in setOperations.
   * - It takes data with size the number of cells of the grid for scalars or three times the size for vectors.
   * @example
   * model.update({ name: "U", data: U });
   * @param {Object} dict - The input dictionary.
   * @property {string} dict.field - The field
   * @property {Float64Array} dict.data - The data field
   * @returns {void}
   */
  update(dict) {
    this.fieldName = dict.field;
    if (dict.data.length % (3 * this.nCells) === 0) {
      this.ml.fieldVector().set(dict.data)
      this.nComponents = 3;
    } else if (dict.data.length % this.nCells === 0) {
      this.ml.fieldScalar().set(dict.data)
      this.nComponents = 1;
    } else {
      throw new Error('Invalid field data, not identified as scalar or vector.');
    }

    this.ml.update(this.fieldName, this.nComponents);
    super.operations(this.ml, this.operations);
  }

  /**
   * Gets a string representating the VTK grid
   *
   * @example
   * var grid = model.grid();
   * @returns {string} The grid data as a string
   */
  grid() {
    return super.grid(this.ml);
  }

  /**
   * Gets the value of a given field at a given point.
   *
   * @example
   * var result = model.probe({ field: "U", point:  [10, 30, 40] });
   * @param {Object} dict - The input dictionary.
   * @property {string} dict.field - The field
   * @property {number[]} dict.point - The point, which is an array with three
   * numbers representing the x,y,z coordinates.
   * @returns {number[]} The result, an array with four numbers [x, y, z, mag], where x, y,
   * and z are the coordinate values and mag is the magnitude.
   */
  probe(dict) {
    return super.probe(this.ml, dict);
  }

  /**
   * Gets the integrated value of a given field for the whole domain or the
   * active component.
   *
   * - A component must have been defined with the `setComponent` function.
   *
   * @param {Object} dict - The input dictionary.
   * @property {string} dict.field - The field
   * @property {string} dict.target - The target property.
   * Must be one of:
   * - "grid" for averaging the field over the whole grid, or
   * - "component" for averaging over the active component.
   * @result {extent: number, result: number|number[]} - Returns the:
   * - extent of the integration, representing the volume or area
   *   depending if the target is set to "grid" or "component"
   *   respectively.
   * - result of the integration, being a single number or an array of
   *   four numbers [x, y, z, mag] if the field is a scalar or a vector,
   *   respectively.
   */
  integrate(dict) {
    return super.integrate(this.ml, dict);
  }

  /**
   * Gets the rendered colors for the active component for the given field
   *
   * @example
   * var render = model.render({
   *   field: "U",
   *   // component: 1,
   *   // range: [0, 1.0],
   * });
   * var colors = render.colors;
   * var range = render.range;
   * @param {Object} dict - The input dictionary.
   * @property {string} dict.field - The field
   * @property {number[]} [dict.range] - The range for the colormap, otherwise
   * it automatically adjusts to the field range.
   * @property {number} [dict.index] - The component index for vectors,
   * otherwise the field magnitude is rendered.
   * @result {{colors: Float32Array, range: number[]}} - Returns the rendered
   * colors array and the range of the field.
   */
  render(dict) {
    return super.render(this.component, dict, this.ml);
  }

  /**
   * Sets a visualization component and returns a string representation
   * of a GLTF
   *
   * @example
   * var gltfSurfce = model.setComponent({
   *   type: "surface"
   * });
   *
   * var gltfPlane = model.setComponent({
   *   type: "plane",
   *   planeProperties: {
   *     origin: [0, 0, 0],
   *     normal: [1, 0, 0]
   *   }
   * });
   *
   * var gltfStreamlines = model.setComponent({
   *   type: "streamlines",
   *   streamlinesProperties: {
   *     field: "U",
   *     center: [0, 0, 0],
   *     radius: 1.0,
   *     resolution: 8,
   *     tubeRadius: 0.1,
   *     tubeSides: 30,
   *     propagation: 300.0
   *   }
   * });
   * @param {Object} dict
   * @property {string} dict.component - The component to visualize.
   * Must be one of "surface", "plane", or "streamlines".
   * @property {number[]} [dict.planeProperties.origin] - Required when component
   * is "plane. The origin vector, which is an array with three numbers
   * representing the x,y,z coordinates.
   * @property {number[]} [dict.planeProperties.normal] - Required when component
   * is "plane. The normal vector, which is an array with three numbers
   * representing the x,y,z coordinates.
   * @property {string} [dict.streamlinesProperties.field] - Required when component
   * is "streamlines". The field to calculate the streamlines.
   * @property {number[]} [dict.streamlinesProperties.center] - Required when component
   * is "streamlines. The center of the streamlines seeding sphere, which is
   * an array with three numbers representing the x,y,z coordinates.
   * @property {number} [dict.streamlinesProperties.radius] - Required when component
   * is "streamlines". The radius of the streamlines seeding sphere.
   * @property {number} [dict.streamlinesProperties.propagation] - Required when component
   * is "streamlines". The propagation lenght of the streamlines.
   * @property {number} [dict.streamlinesProperties.tubeRadius] - Required when component
   * is "streamlines". The radius of the streamlines tube.
   * @property {number} [dict.streamlinesProperties.tubeSides] - Required when component
   * is "streamlines".The number of sides for streamlines tubes.
   * @property {number} [dict.streamlinesProperties.resolution] - Required when component
   * is "streamlines". The numbers of streamlines to generate.
   * @returns {string} The GLTF data as a string
   */
  setComponent(dict) {
    this.component = dict.component;

    return super.setComponent(dict, this.ml);
  }

  /**
   * Sets the operations needed on update.
   *
   * @example
   * model.setOperations{ operations: ["gradients", "vorticity"] }
   * @param {Object} dict - The input dictionary.
   * @property {string[]} dict.operations - Array of operations to be performed.
   * Valid options are "gradients" and "vorticity".
   *   - "gradients" generates a gradients field
   *   - "vorticity" generates a vorticity field
   * @returns {void}
   */
  setOperations(dict) {
    this.operations = [];
    for (var i = 0; i < dict.operations.length; i++) {
      switch (dict.operations[i]) {
        case 'vorticity':
          this.operations.push(dict.operations[i]);
        break;
        case 'gradients':
          this.operations.push(dict.operations[i]);
        break;
        default:
          throw new Error('Invalid operation. Only vorticity and gradients currently supported.');
        break;
      }
    }
  }
}

/**
 * Class for dealing with ITHACA-FV models
 * ```
 * var model = jsfluids.ITHACAFV;
 * ```
 * @class
 * @memberof jsfluids
 * @alias jsfluids.ITHACAFV
 * @description This class is an optional wrapper around a dynamically loaded
 * LGPL rom-js module. It loads a separate and independent chunk when initializing
 * jsfluids.ITHACAFV
 */
class ITHACAFVWrapper extends VTKFunctions {
  /**
   * Creates a new ITHACAFVWrapper object
   * @hideconstructor
   */
  constructor() {
    super();

    this.component = "surface";
    this.operations = [];
  }

  async init(){
    if (process.env.WITH_ITHACAFV === 'true') {
      try {
        const ithacafvModule = await import(/* webpackChunkName: "ithacafv" */ './ITHACAFV.js');
        const ithacafv = ithacafvModule.default;
        await ithacafv.ready;
        this.ithacafv = new ithacafv.ITHACAFV();
      } catch (err) {
        console.error('Error initializing ITHACA-FV:', err);
      }
    }
    else {
      console.error('ITHACA-FV not initialized');
    }
  }

  /**
   * Loads a VTK Unstructured Grid (.vtu) mesh from either an URL or a buffer.
   *
   * This function initialize the module and the sence, and sets the number
   * of cells.
   *
   * @example
   * model.loadMesh(meshURL).then(() => {
   *   ...
   * });
   * @param {string|Buffer} mesh - The mesh to load, which can be either an URL
   * or a buffer of a VTU file:
   * - If mesh is a string, it is treated as an URL and the mesh will be loaded
   *   from the URL.
   * - If mesh is a buffer, the mesh will be loaded from the buffer.
   */
  async loadMesh(mesh) {
    await this.init();
    if (Buffer.isBuffer(mesh)) {
      this.ithacafv.readUnstructuredGrid(mesh);
    } else if (ArrayBuffer.isView(mesh)) {
      const decoder = new TextDecoder('utf-8');
      const meshString = decoder.decode(mesh);
      this.ithacafv.readUnstructuredGrid(meshString);
    } else if (typeof mesh === 'string') {
      const response = await axios.get(mesh);
      this.ithacafv.readUnstructuredGrid(response.data);
    } else {
      throw new Error('Invalid input type. Must be either a Buffer'
        + ' or a URL string.');
    }
    this.ithacafv.initScene();
  }

  /**
   * Loads an ITHACA-FV model with its matrices and related files bundled
   * in a ZIP files.
   *
   * This function initialize the module and the scene, and sets the number
   * of cells.
   *
   * @example
   * model.loadModel(romURL).then(() => {
   *   ...
   * });
   * @param {Buffer|TypedArray|string} mesh - The mesh to load, which can be either an URL
   * or a buffer of a VTU file:
   * - If mesh is a buffer, the mesh will be loaded from the buffer.
   * - If mesh is a TypedArray, the mesh will be decoded from UTF-8 to a string.
   * - If mesh is a string, it is treated as an URL and the mesh will be loaded
   *   from the URL.
   */
  async loadModel(input) {
    let data;
    if (Buffer.isBuffer(input)) {
        data = input;
    } else if (ArrayBuffer.isView(input)) {
      data = input;
    } else if (typeof input === 'string') {
      const response = await axios.get(input, {responseType: 'blob'});
      data = response.data;
    }
    else {
    }

    const zipFiles = await jszip.loadAsync(data);

    const K = await readFile(zipFiles, "K_mat.txt");
    const B = await readFile(zipFiles, "B_mat.txt");
    const bt = await readFile(zipFiles, "bt_mat.txt");
    const coeffL2 = await readFile(zipFiles, 'coeffL2_mat.txt');
    const mu = await readFile(zipFiles, 'par.txt');

    const nPhiU = B[1];
    const nPhiP = K[2];
    const nPhiNut = coeffL2[1];
    const nRuns = coeffL2[2];

    const checkPPE = zipFiles.files["G0_mat.txt"];

    if (checkPPE) {
      this.ithacafv.setStabilization("PPE");
    } else {
      this.ithacafv.setStabilization("supremizer");
    }

    this.ithacafv.setNPhiU(nPhiU);
    this.ithacafv.setNPhiP(nPhiP);
    this.ithacafv.setNPhiNut(nPhiNut);
    this.ithacafv.setNRuns(nRuns);
    this.ithacafv.setNBC(2);
    this.ithacafv.initialize();
    this.ithacafv.K().set(K[0]);
    this.ithacafv.B().set(B[0]);
    this.ithacafv.bt().set(bt[0]);
    this.ithacafv.coeffL2().set(coeffL2[0]);
    this.ithacafv.mu().set(mu[0]);

    if (checkPPE) {
      const D = await readFile(zipFiles, 'D_mat.txt');
      const BC3 = await readFile(zipFiles, 'BC3_mat.txt');

      this.ithacafv.D().set(D[0]);
      this.ithacafv.BC3().set(BC3[0]);
    }
    else {
      const PData = await readFile(zipFiles, 'P_mat.txt');
      this.ithacafv.P().set(PData[0]);
    }

    if (zipFiles.files['EigenModes_U_mat.txt']) {
      const modesU = await readFile(zipFiles, 'EigenModes_U_mat.txt');
      this.ithacafv.modesU().set(modesU[0]);
    }

    if (zipFiles.files['EigenModes_p_mat.txt']) {
      const modesP = await readFile(zipFiles, 'EigenModes_p_mat.txt');
      this.ithacafv.modesP().set(modesP[0]);
    }

    if (zipFiles.files['EigenModes_nut_mat.txt']) {
      const modesNut = await readFile(zipFiles, 'EigenModes_nut_mat.txt');
      this.ithacafv.modesNut().set(modesNut[0]);
    }

    for (let i = 0; i < nPhiNut; i ++ ) {
      const weights = await readFile(zipFiles, 'wRBF_' + i + '_mat.txt');

      this.ithacafv.weights().set(weights[0]);
      this.ithacafv.addWeights();
    }

    for (let i = 0; i < nPhiU; i ++ ) {
      const C = await readFile(zipFiles, 'C' + i + '_mat.txt');
      const Ct1 = await readFile(zipFiles, 'ct1_' + i + '_mat.txt');
      const Ct2 = await readFile(zipFiles, 'ct2_' + i + '_mat.txt');

      this.ithacafv.C().set(C[0]);
      this.ithacafv.addCMatrix();
      this.ithacafv.Ct1().set(Ct1[0]);
      this.ithacafv.addCt1Matrix();
      this.ithacafv.Ct2().set(Ct2[0]);
      this.ithacafv.addCt2Matrix();
    }

    if (checkPPE) {
      for (let i = 0; i < nPhiP; i ++ ) {
        const G = await readFile(zipFiles, 'G' + i + '_mat.txt');

        this.ithacafv.G().set(G[0]);
        this.ithacafv.addGMatrix();
      }
    }

    this.ithacafv.setRBF();
  }

  /**
   * Solves the ROM online solution and Updates the fields in the loaded grid.
   * It also applies the operations defined in setOperations.
   *
   * @example
   * model.update({ nu: 1.0e-05, U: [10.0, 0.0] });
   * @param {Object} dict - The input dictionary.
   * @property {number} dict.nu - The domain viscosity
   * @property {number[]} dict.U - The inlet velocity. An array with two numbers
   * with the two coordinate values at the inlet.
   * @returns {void}
   */
  update(dict) {
    this.ithacafv.setNu(dict.nu);
    this.ithacafv.solveOnline(dict.U[0], dict.U[1]);
    this.ithacafv.reconstruct();
    super.operations(this.ithacafv, this.operations);
  }

  /**
   * Gets a string representating the VTK grid
   *
   * @example
   * var grid = model.grid();
   * @returns {string} The grid data as a string
   */
  grid() {
    return super.grid(this.ithacafv);
  }

  /**
   * Gets the value of a given field at a given point.
   *
   * @example
   * var result = model.probe({ field: "U", point:  [10, 30, 40] });
   * @param {Object} dict - The input dictionary.
   * @property {string} dict.field - The field
   * @property {number[]} dict.point - The point, which is an array with three
   * numbers representing the x,y,z coordinates.
   * @returns {number[]} The result, an array with four numbers [x, y, z, mag], where x, y,
   * and z are the coordinate values and mag is the magnitude.
   */
  probe(dict) {
    return super.probe(this.ithacafv, dict);
  }

  /**
   * Gets the integrated value of a given field for the whole domain or the
   * active component.
   *
   * - A component must have been defined with the `setComponent` function.
   *
   * @param {Object} dict - The input dictionary.
   * @property {string} dict.field - The field
   * @property {string} dict.target - The target property.
   * Must be one of:
   * - "grid" for averaging the field over the whole grid, or
   * - "component" for averaging over the active component.
   * @result {extent: number, result: number|number[]} - Returns the:
   * - extent of the integration, representing the volume or area
   *   depending if the target is set to "grid" or "component"
   *   respectively.
   * - result of the integration, being a single number or an array of
   *   four numbers [x, y, z, mag] if the field is a scalar or a vector,
   *   respectively.
   */
  integrate(dict) {
    return super.integrate(this.ithacafv, dict);
  }

  /**
   * Gets the rendered colors for the active component for the given field
   *
   * @example
   * var render = model.render({
   *   field: "U",
   *   // index: 1,
   *   // range: [0, 1.0],
   * });
   * var colors = render.colors;
   * var range = render.range;
   * @param {Object} dict - The input dictionary.
   * @property {string} dict.field - The field
   * @property {number[]} [dict.range] - The range for the colormap, otherwise
   * it automatically adjusts to the field range.
   * @property {number} [dict.index] - The component index for vectors,
   * otherwise the field magnitude is rendered.
   * @result {{colors: Float32Array, range: number[]}} - Returns the rendered
   * colors array and the range of the field.
   */
  render(dict) {
    return super.render(this.component, dict, this.ithacafv);
  }

  /**
   * Sets a visualization component and returns a string representation
   * of a GLTF
   *
   * @example
   * var gltfSurfce = model.setComponent({
   *   type: "surface"
   * });
   *
   * var gltfPlane = model.setComponent({
   *   type: "plane",
   *   planeProperties: {
   *     origin: [0, 0, 0],
   *     normal: [1, 0, 0]
   *   }
   * });
   *
   * var gltfStreamlines = model.setComponent({
   *   type: "streamlines",
   *   streamlinesProperties: {
   *     field: "U",
   *     center: [0, 0, 0],
   *     radius: 1.0,
   *     resolution: 8,
   *     tubeRadius: 0.1,
   *     tubeSides: 30,
   *     propagation: 300.0
   *   }
   * });
   * @param {Object} dict
   * @property {string} dict.component - The component to visualize.
   * Must be one of "surface", "plane", or "streamlines".
   * @property {number[]} [dict.planeProperties.origin] - Required when component
   * is "plane. The origin vector, which is an array with three numbers
   * representing the x,y,z coordinates.
   * @property {number[]} [dict.planeProperties.normal] - Required when component
   * is "plane. The normal vector, which is an array with three numbers
   * representing the x,y,z coordinates.
   * @property {string} [dict.streamlinesProperties.field] - Required when component
   * is "streamlines". The field to calculate the streamlines.
   * @property {number[]} [dict.streamlinesProperties.center] - Required when component
   * is "streamlines. The center of the streamlines seeding sphere, which is
   * an array with three numbers representing the x,y,z coordinates.
   * @property {number} [dict.streamlinesProperties.radius] - Required when component
   * is "streamlines". The radius of the streamlines seeding sphere.
   * @property {number} [dict.streamlinesProperties.propagation] - Required when component
   * is "streamlines". The propagation lenght of the streamlines.
   * @property {number} [dict.streamlinesProperties.tubeRadius] - Required when component
   * is "streamlines". The radius of the streamlines tube.
   * @property {number} [dict.streamlinesProperties.tubeSides] - Required when component
   * is "streamlines".The number of sides for streamlines tubes.
   * @property {number} [dict.streamlinesProperties.resolution] - Required when component
   * is "streamlines". The numbers of streamlines to generate.
   * @returns {string} The GLTF data as a string
   */


  setComponent(dict) {	  
    this.component = dict.component;

    return super.setComponent(dict, this.ithacafv);
  }

  /**
   * Sets the operations needed on update.
   *
   * @example
   * model.setOperations{ operations: ["gradients", "vorticity"] }
   * @param {Object} dict - The input dictionary.
   * @property {string[]} dict.operations - Array of operations to be performed.
   * Valid options are "gradients" and "vorticity".
   *   - "gradients" generates a gradients field
   *   - "vorticity" generates a vorticity field
   * @returns {void}
   */
  setOperations(dict) {
    this.operations = [];
    for (var i = 0; i < dict.operations.length; i++) {
      switch (dict.operations[i]) {
        case 'vorticity':
          this.operations.push(dict.operations[i]);
        break;
        case 'gradients':
          this.operations.push(dict.operations[i]);
        break;
        default:
          throw new Error('Invalid operation. Only vorticity and gradients currently supported.');
        break;
      }
    }
  }
}


const readyPromise = new Promise((resolve) => {
  Module.then(async (module) => {
    jsfluids.ML = new MLWrapper();
    jsfluids.ITHACAFV = new ITHACAFVWrapper();

    resolve();
  });
});

jsfluids.ready = readyPromise

export default jsfluids
