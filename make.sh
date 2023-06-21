# Author: Carlos Peña-Monferrer (SIMZERO) - 2023
#!/bin/bash

git submodule update --init --recursive thirdparty/vtk

echo "#############################"
echo  BUILDING fluids.js
echo "#############################"

ROOT=/build

BUILD_ROOT=$ROOT/thirdparty
VTK_ROOT=$BUILD_ROOT/vtk
VTK_BUILD=$BUILD_ROOT/vtk/vtk-wasm
VTK_LIB_VERSION=9.2

BUILD_ROOT_ROMJS=$BUILD_ROOT/rom-js/thirdparty
EIGEN_ROOT=$BUILD_ROOT_ROMJS/eigen
EIGEN_VERSION=3.4.0
SPLINTER_ROOT=$BUILD_ROOT_ROMJS/splinter
SPLINTER_SOURCE=$SPLINTER_ROOT/src
SPLINTER_INCLUDE=$SPLINTER_ROOT/include
SPLINTER_BUILD=$SPLINTER_ROOT/splinter-wasm
ROMJS_ROOT=$BUILD_ROOT/rom-js
ROMJS_INCLUDE=$ROMJS_ROOT/src
ITHACA_ROMPROBLEMS=$BUILD_ROOT_ROMJS/ithaca-fv/src/ITHACA_ROMPROBLEMS

if [ ! -d ./build  ];then
  mkdir -p ./build
fi


# TODO: check a bug with CMakeLists.txt
VTK_OPTIONS="
  -I $VTK_BUILD/Common/ExecutionModel \
  -I $VTK_ROOT/Common/ExecutionModel \
  -I $VTK_ROOT/Common/Color \
  -I $VTK_BUILD/Common/Core \
  -I $VTK_ROOT/Common/Core \
  -I $VTK_BUILD/Common/DataModel \
  -I $VTK_ROOT/Common/DataModel \
  -I $VTK_BUILD/Common/Misc \
  -I $VTK_ROOT/Common/Misc \
  -I $VTK_BUILD/Common/Math \
  -I $VTK_ROOT/Common/Math \
  -I $VTK_ROOT/Common/Sytem \
  -I $VTK_ROOT/Domains/Chemistry \
  -I $VTK_BUILD/Filters/Core \
  -I $VTK_ROOT/Filters/Core \
  -I $VTK_BUILD/Filters/General \
  -I $VTK_ROOT/Filters/General \
  -I $VTK_BUILD/Filters/Parallel \
  -I $VTK_ROOT/Filters/Parallel \
  -I $VTK_BUILD/Filters/FlowPaths \
  -I $VTK_ROOT/Filters/FlowPaths \
  -I $VTK_BUILD/Filters/Geometry \
  -I $VTK_ROOT/Filters/Geometry \
  -I $VTK_BUILD/Filters/Sources \
  -I $VTK_ROOT/Filters/Sources \
  -I $VTK_ROOT/Imaging/Core \
  -I $VTK_BUILD/IO/Core \
  -I $VTK_ROOT/IO/Core \
  -I $VTK_BUILD/IO/Export \
  -I $VTK_ROOT/IO/Export \
  -I $VTK_BUILD/IO/Geometry \
  -I $VTK_ROOT/IO/Geometry \
  -I $VTK_BUILD/IO/Image \
  -I $VTK_ROOT/IO/Image \
  -I $VTK_BUILD/IO/Legacy \
  -I $VTK_ROOT/IO/Legacy \
  -I $VTK_BUILD/IO/XML \
  -I $VTK_ROOT/IO/XML \
  -I $VTK_BUILD/IO/XMLParser \
  -I $VTK_ROOT/IO/XMLParse \
  -I $VTK_BUILD/Rendering/Annotation \
  -I $VTK_ROOT/Rendering/Annotation \
  -I $VTK_BUILD/Rendering/Context2D \
  -I $VTK_BUILD/Rendering/Core \
  -I $VTK_ROOT/Rendering/Core \
  -I $VTK_BUILD/Rendering/FreeType \
  -I $VTK_BUILD/Rendering/OpenGL2 \
  -I $VTK_ROOT/Rendering/OpenGL2 \
  -I $VTK_BUILD/Rendering/UI \
  -I $VTK_ROOT/Rendering/UI \
  -I $VTK_BUILD/Rendering/HyperTreeGrid \
  -I $VTK_ROOT/Rendering/HyperTreeGrid \
  -I $VTK_BUILD/Utilities/KWSys \
  -I $VTK_BUILD/Utilities/KWIML \
  -I $VTK_ROOT/Utilities/KWIML \
  -I $ROMJS_INCLUDE \
  -Isrc/VTK \
  -L $VTK_BUILD/lib \
  -lvtkdoubleconversion-$VTK_LIB_VERSION \
  -lvtkexpat-$VTK_LIB_VERSION \
  -lvtkpng-$VTK_LIB_VERSION \
  -lvtkjpeg-$VTK_LIB_VERSION \
  -lvtkfreetype-$VTK_LIB_VERSION \
  -lvtkpugixml-$VTK_LIB_VERSION \
  -lvtklz4-$VTK_LIB_VERSION \
  -lvtklzma-$VTK_LIB_VERSION \
  -lvtksys-$VTK_LIB_VERSION \
  -lvtkzlib-$VTK_LIB_VERSION \
  -lvtkCommonColor-$VTK_LIB_VERSION \
  -lvtkCommonCore-$VTK_LIB_VERSION \
  -lvtkCommonDataModel-$VTK_LIB_VERSION \
  -lvtkCommonExecutionModel-$VTK_LIB_VERSION \
  -lvtkCommonMath-$VTK_LIB_VERSION \
  -lvtkCommonMisc-$VTK_LIB_VERSION \
  -lvtkCommonSystem-$VTK_LIB_VERSION \
  -lvtkCommonTransforms-$VTK_LIB_VERSION \
  -lvtkDomainsChemistry-$VTK_LIB_VERSION \
  -lvtkImagingCore-$VTK_LIB_VERSION \
  -lvtkIOCore-$VTK_LIB_VERSION \
  -lvtkIOExport-$VTK_LIB_VERSION \
  -lvtkIOGeometry-$VTK_LIB_VERSION \
  -lvtkIOImage-$VTK_LIB_VERSION \
  -lvtkIOLegacy-$VTK_LIB_VERSION \
  -lvtkIOXMLParser-$VTK_LIB_VERSION \
  -lvtkIOXML-$VTK_LIB_VERSION \
  -lvtkFiltersCore-$VTK_LIB_VERSION \
  -lvtkFiltersGeneral-$VTK_LIB_VERSION \
  -lvtkFiltersParallel-$VTK_LIB_VERSION \
  -lvtkFiltersGeometry-$VTK_LIB_VERSION \
  -lvtkFiltersFlowPaths-$VTK_LIB_VERSION \
  -lvtkFiltersSources-$VTK_LIB_VERSION \
  -lvtkParallelCore-$VTK_LIB_VERSION \
  -lvtkRenderingAnnotation-$VTK_LIB_VERSION \
  -lvtkRenderingFreeType-$VTK_LIB_VERSION \
  -lvtkRenderingCore-$VTK_LIB_VERSION \
  -lvtkRenderingOpenGL2-$VTK_LIB_VERSION \
  -lvtkRenderingUI-$VTK_LIB_VERSION \
  -lvtkRenderingHyperTreeGrid-$VTK_LIB_VERSION \
"

EMSCRIPTEN_OPTIONS="
  -Isrc \
  -sASSERTIONS \
  -sEXCEPTION_CATCHING_ALLOWED=[..] \
  -s USE_PTHREADS=0 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME='vtk' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MAXIMUM_MEMORY=4GB \
  -O2 \
  --bind \
"

# Code splitting for dynamic loads
emcc \
  $VTK_OPTIONS \
  $EMSCRIPTEN_OPTIONS \
  -o ./build/ml.js \
  ./src/ML.cc

if [[ "$WITH_ITHACAFV" = "true" ]]; then
  # This is the optional ITHACA-FV build
  emcc \
    $VTK_OPTIONS \
   -I $ITHACA_ROMPROBLEMS/NonLinearSolvers \
   -I $SPLINTER_INCLUDE \
   -I $ROMJS_INCLUDE \
   -I $EIGEN_ROOT \
   -L $SPLINTER_BUILD \
   -lsplinter-3-0 \
   $EMSCRIPTEN_OPTIONS \
   -o ./build/ithacafv.js \
   ./src/ITHACAFV.cc
else
  echo "Building without ITHACA-FV"
fi

emcc \
  $VTK_OPTIONS \
  $EMSCRIPTEN_OPTIONS \
  -s "EXPORTED_RUNTIME_METHODS=['ccall', 'cwrap']" \
  -o ./build/jsfluids.js
