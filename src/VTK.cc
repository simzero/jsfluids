// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

#include <emscripten/bind.h>
#include "VTK.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(Module_VTK) {
    class_<VTK>("VTK")
        .constructor<>()
        .function("exportUnstructuredGrid", &VTK::exportUnstructuredGrid)
        .function("gradients", &VTK::gradients)
        .function("integrate", &VTK::integrate)
        .function("exporter", &VTK::exporter)
        .function("probe", &VTK::probe)
        .function("initScene", &VTK::initScene)
        .function("geometry", &VTK::geometry)
        .function("plane", &VTK::plane)
        .function("readUnstructuredGrid", &VTK::readUnstructuredGrid)
        .function("removeAllActors", &VTK::removeAllActors)
        .function("render", &VTK::render)
        .function("scalarBarRange", &VTK::scalarBarRange)
	.function("stlToVtp", &VTK::stlToVtp)
        .function("streams", &VTK::streams)
        .function("unstructuredGridToPolyData", &VTK::unstructuredGridToPolyData)
        ;
}
