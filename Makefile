.PHONY: thirdparty build

SHELL := /bin/bash

web-wasm-image := dockcross/web-wasm:20230601-c2f5366
web-wasm := docker run --rm --user=emscripten -it -e WITH_ITHACAFV=${WITH_ITHACAFV} -e CORES=${CORES} -v ${PWD}:/build -w /build $(web-wasm-image)

all: install thirdparty build
native-all: native-install native-thirdparty native-thirdparty-emcc native-build native-tools

install:
	git submodule update --init --recursive thirdparty/vtk \
	&& $(web-wasm) npm install
ifeq ($(WITH_ITHACAFV),true)
thirdparty:
	git submodule update --init --recursive thirdparty/rom-js \
	&& cd thirdparty/rom-js && make install &&  SKIP_VTK=true make thirdparty \
	&& $(web-wasm) /bin/bash -c "cd thirdparty && WITH_ITHACAFV=true ./make.sh"
else
thirdparty:
	$(web-wasm) /bin/bash -c "cd thirdparty &&  ./make.sh"
endif
build:
	$(web-wasm) /bin/bash -c "./make.sh && npm run build" 
clean:
	rm -rf ./build ./dist ./node_modules
