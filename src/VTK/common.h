// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

#ifndef COMMON_H
#define COMMON_H
  virtual string exporter() {
    return VTK::exporter();
  }

  virtual string exportUnstructuredGrid() {
    return VTK::exportUnstructuredGrid();
  }

  virtual void geometry() {
    return VTK::geometry();
  }

  virtual void gradients(bool vorticity, bool gradients) {
    return VTK::gradients(vorticity, gradients);
  }

  virtual void initScene() {
    VTK::initScene();
  }

  virtual string plane(float originX, float originY, float originZ ,
    float normalX, float normalY, float normalZ) {
    return VTK::plane(originX, originY, originZ, normalX, normalY, normalZ);
  }

  virtual int readUnstructuredGrid(string const& buffer) {
    return VTK::readUnstructuredGrid(buffer);
  }

  virtual void removeAllActors() {
    return VTK::removeAllActors();
  }

  // double integrate(string field, string type) {
  emscripten::val integrate(string field, string type) {
    return VTK::integrate(field, type);
  }

  emscripten::val probe(string field, float pointX, float pointY, float pointZ) {
    return VTK::probe(field, pointX, pointY, pointZ);
  }

  emscripten::val scalarBarRange(int componentIndex = -1) {
    return VTK::scalarBarRange(componentIndex);
  }

  emscripten::val render(string component, string field, int componentIndex = -1,
    double minValue = 0, double maxValue = 0) {
    return VTK::render(component, field, componentIndex, minValue, maxValue);
  }

  virtual string streams(
    float centerX,
    float centerY,
    float centerZ,
    double radius,
    double length,
    double tubeRadius,
    double tubeSides,
    double resolution,
    string field) {

    return VTK::streams(
      centerX,
      centerY,
      centerZ,
      radius,
      length,
      tubeRadius,
      tubeSides,
      resolution,
      field
    );
  }

  virtual string unstructuredGridToPolyData() {
    return VTK::unstructuredGridToPolyData();
  }
#endif // COMMON_H
