// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

#include <emscripten/bind.h>
#include <iostream>
#include "ITHACAFV.h"
#include "VTK.cc"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(Module_ITHACAFV)
{
    class_<ITHACAFV, base<VTK>>("ITHACAFV")
        .constructor<>()
	.constructor<const ITHACAFV &>()
        .function("setNPhiU", &ITHACAFV::setNPhiU)
        .function("setNPhiP", &ITHACAFV::setNPhiP)
        .function("setNPhiNut", &ITHACAFV::setNPhiNut)
        .function("setNRuns", &ITHACAFV::setNRuns)
        .function("setNBC", &ITHACAFV::setNBC)
        .function("setStabilization", &ITHACAFV::setStabilization)
        .function("setNu", &ITHACAFV::setNu)
        .function("initialize", &ITHACAFV::initialize)
        .function("solveOnline", &ITHACAFV::solveOnline)
        .function("addWeights", &ITHACAFV::addWeights)
        .function("addCMatrix", &ITHACAFV::addCMatrix)
        .function("addGMatrix", &ITHACAFV::addGMatrix)
        .function("addCt1Matrix", &ITHACAFV::addCt1Matrix)
        .function("addCt2Matrix", &ITHACAFV::addCt2Matrix)
        .function("setRBF", &ITHACAFV::setRBF)
        .function("B", &ITHACAFV::B)
        .function("K", &ITHACAFV::K)
        .function("P", &ITHACAFV::P)
        .function("D", &ITHACAFV::D)
        .function("BC3", &ITHACAFV::BC3)
        .function("mu", &ITHACAFV::mu)
        .function("coeffL2", &ITHACAFV::coeffL2)
        .function("modesU", &ITHACAFV::modesU)
        .function("modesP", &ITHACAFV::modesP)
        .function("modesNut", &ITHACAFV::modesNut)
        .function("C", &ITHACAFV::C)
        .function("Ct1", &ITHACAFV::Ct1)
        .function("Ct2", &ITHACAFV::Ct2)
        .function("weights", &ITHACAFV::weights)
        .function("G", &ITHACAFV::G)
        .function("reconstruct", &ITHACAFV::reconstruct)
        .function("clear", &ITHACAFV::clear)
	;
}
