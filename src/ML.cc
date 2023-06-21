// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

#include <emscripten/bind.h>
#include <iostream>
#include "ML.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(Module)
{
    class_<ML, base<VTK>>("ML")
        .constructor<>()
        .function("fieldVector", &ML::fieldVector)
        .function("fieldScalar", &ML::fieldScalar)
        .function("update", &ML::update)
        .function("computeSDFAndRegion", &ML::computeSDFAndRegion)
	;
}
