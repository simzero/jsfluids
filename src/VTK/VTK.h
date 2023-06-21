// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

#ifndef VTK_H
#define VTK_H

#include <stdlib.h>
#include <string>
#include <fstream>
#include <sstream>
#include <list>
#include <vector>

#include <emscripten.h>
#include <emscripten/bind.h>

#include <vtkActor.h>
#include <vtkCellData.h>
#include <vtkCellDataToPointData.h>
#include <vtkCutter.h>
#include <vtkDoubleArray.h>
#include <vtkGeometryFilter.h>
#include <vtkGradientFilter.h>
#include <vtkOBJExporter.h>
#include <vtkGLTFExporter.h>
#include <vtkImageData.h>
#include <vtkIntegrateAttributes.h>
#include <vtkUnsignedCharArray.h>
#include <vtkMultiBlockDataSet.h>
#include <vtkLookupTable.h>
#include <vtkNew.h>
#include <vtkPlane.h>
#include <vtkPointData.h>
#include <vtkPolyData.h>
#include <vtkPolyDataMapper.h>
#include <vtkPNGWriter.h>
#include <vtkProbeFilter.h>
#include <vtkRenderWindow.h>
#include <vtkRenderer.h>
#include <vtkSmartPointer.h>
#include <vtkSphereSource.h>
#include <vtkStreamTracer.h>
#include <vtkSTLReader.h>
#include <vtkTubeFilter.h>
#include <vtkUnstructuredGrid.h>
#include <vtkXMLPolyDataReader.h>
#include <vtkXMLPolyDataWriter.h>
#include <vtkXMLUnstructuredGridReader.h>
#include <vtkXMLUnstructuredGridWriter.h>

using namespace std;

class VTK {

public:
  virtual ~VTK(){
    vtkObject::GlobalWarningDisplayOff();
  };

  auto readBuffer(string const& filename) {
    std::ifstream in(filename.c_str());
    string buffer;
    if(in) {
      ostringstream ss;
      ss << in.rdbuf(); // reading data
      buffer = ss.str();
    }

    return buffer;
  }

  auto writeBuffer(string const& buffer, string const& extension) {
    std::ofstream out("file." + extension);
    out << buffer;
    out.close();
  }

  virtual string stlToVtp(string const& buffer) {
    writeBuffer(buffer, "stl");

    vtkNew<vtkSTLReader> stlReader;
    stlReader->SetFileName("file.stl");
    stlReader->Update();

    vtkNew<vtkXMLPolyDataWriter> polyDataXMLWriter;
    polyDataXMLWriter->SetInputData(stlReader->GetOutput());
    polyDataXMLWriter->WriteToOutputStringOn();
    polyDataXMLWriter->SetDataModeToAscii();
    polyDataXMLWriter->Update();
    polyDataXMLWriter->Write();

    string output = polyDataXMLWriter->GetOutputString();

    return output;
  }

  virtual int readUnstructuredGrid(std::string const& buffer) {
    vtkNew<vtkXMLUnstructuredGridReader> reader;
    reader->ReadFromInputStringOn();
    reader->SetInputString(buffer);
    reader->Update();

    grid->DeepCopy(reader->GetOutput());
    nCells = grid->GetNumberOfCells();
    fieldVectorVector.resize(3*nCells);
    fieldScalarVector.resize(nCells);

    return nCells;
  }

  virtual string plane(float originX, float originY, float originZ,
    float normalX, float normalY, float normalZ) {
    dynPlane->SetOrigin(originX, originY, originZ);
    dynPlane->SetNormal(normalX, normalY, normalZ);

    cutter->SetCutFunction(dynPlane);
    cutter->SetInputData(grid);
    cutter->Update();

    polydata = cutter->GetOutput();

    polyDataWriter->SetInputConnection(cutter->GetOutputPort());
    polyDataWriter->WriteToOutputStringOn();
    polyDataWriter->Write();

    return polyDataWriter->GetOutputString();
  }

  virtual string unstructuredGridToPolyData() {
    vtkNew<vtkGeometryFilter> geometryFilter;
    geometryFilter->SetInputData(grid);
    geometryFilter->Update();

    vtkNew<vtkXMLPolyDataWriter> writer;
    writer->SetInputConnection(geometryFilter->GetOutputPort());
    writer->WriteToOutputStringOn();
    writer->Write();
    std::string binary_string = writer->GetOutputString();

    return binary_string;
  }

  virtual string exportUnstructuredGrid() {
    unstructuredGridWriter->SetInputData(grid);
    unstructuredGridWriter->WriteToOutputStringOn();
    unstructuredGridWriter->Write();

    return unstructuredGridWriter->GetOutputString();
  }

  virtual void geometry() {
    geometryFilter->SetInputData(grid);
    geometryFilter->Update();

    polydata = geometryFilter->GetOutput();
  }

  virtual void gradients(bool doVorticity, bool doGradients) {
    vtkNew<vtkGradientFilter> gradients;

    if (doVorticity) {
      gradients->ComputeVorticityOn();
      gradients->SetVorticityArrayName("vorticity");
    }

    if (!doGradients) {
      gradients->ComputeGradientOff();
    }

    gradients->FasterApproximationOn();
    gradients->SetInputScalars(vtkDataObject::FIELD_ASSOCIATION_POINTS, "U");
    gradients->SetInputData(grid);
    gradients->SetResultArrayName("gradients");
    gradients->Update();
    grid = gradients->GetUnstructuredGridOutput();
  }

  // double integrate(string field, string target) {
  emscripten::val integrate(string field, string target) {
    vtkNew<vtkIntegrateAttributes> integrated;

    if (target == "grid") {
      integrated->SetInputData(grid);
    }
    else if (target == "component") {
      integrated->SetInputData(polydata);
    }
    else {
      // TODO:
    }

    integrated->SetInputData(grid);
    integrated->Update();

    vtkSmartPointer<vtkDataObject> dataObj = integrated->GetOutputDataObject(0);
    /*vtkSmartPointer<vtkDataObject> dataObj =
            vtkSmartPointer<vtkDataObject>::New();
    dataObj = integrated->GetOutputDataObject(0);*/
    vtkDoubleArray* volumeArray = vtkDoubleArray::SafeDownCast(
      vtkUnstructuredGrid::SafeDownCast(dataObj)->GetCellData()->GetArray("Volume"));
    vtkDoubleArray* areaArray = vtkDoubleArray::SafeDownCast(
      vtkUnstructuredGrid::SafeDownCast(dataObj)->GetCellData()->GetArray("Area"));
    vtkDoubleArray* array = vtkDoubleArray::SafeDownCast(
      vtkUnstructuredGrid::SafeDownCast(dataObj)->GetPointData()->GetArray(field.c_str()));

    int nComponents = array->GetNumberOfComponents();

    if (nComponents > 1) {
      nComponents++;
    }


    auto result = emscripten::val::global("Float64Array").new_(nComponents + 1);

    double extent;

    if (target == "grid") {
      extent = volumeArray->GetValue(0);
    }
    else if (target == "component") {
      extent = areaArray->GetValue(0);
    }

    if (nComponents == 4) {
      vector<double> output(5);

      double mag = std::sqrt(pow(array->GetValue(0), 2) +
                    pow(array->GetValue(1), 2) + pow(array->GetValue(2),2));
      output[0] = extent;
      output[1] = array->GetTuple(0)[0];
      output[2] = array->GetTuple(0)[1];
      output[3] = array->GetTuple(0)[2];
      output[4] = mag;

      emscripten::val view {
        emscripten::typed_memory_view(
          output.size(),
          output.data()
        )
      };

      result.call<void>("set", view);
    }
    else if (nComponents == 1) {
      vector<double> output(2);

      output[0] = extent;
      output[1] = array->GetTuple(0)[0];

      emscripten::val view {
        emscripten::typed_memory_view(
          output.size(),
          output.data()
        )
      };

      result.call<void>("set", view);
    }

    return result;
  }

  emscripten::val probe(string field, float pointX, float pointY, float pointZ) {
    vtkNew<vtkPoints> points;
    points->InsertNextPoint(pointX, pointY, pointZ);

    vtkPolyData* polydataPoints = vtkPolyData::New();
    polydataPoints->SetPoints(points);

    vtkNew<vtkProbeFilter> probe;
    probe->SetInputData(polydataPoints);
    probe->SetSourceData(grid);
    probe->Update();

    vtkDataSet* probeData = probe->GetOutput();

    vtkPointData* pointData = probeData->GetPointData();
    vtkDataArray* valid = pointData->GetArray("vtkValidPointMask");

    vector<double> output(4);

    if (valid->GetTuple1(0) == 0)
    {
      for (int i = 0; i < 4; ++i)
      {
        output[i] = std::numeric_limits<double>::quiet_NaN();
      }
    }
    else
    {
      vtkDataArray* array = pointData->GetArray(field.c_str());
      double UMag = std::sqrt(pow(array->GetTuple(0)[0], 2) +
        pow(array->GetTuple(0)[1], 2) + pow(array->GetTuple(0)[2],2));
      output[0] = array->GetTuple(0)[0];
      output[1] = array->GetTuple(0)[1];
      output[2] = array->GetTuple(0)[2];
      output[3] = UMag;
    }

    emscripten::val view {
      emscripten::typed_memory_view(
        output.size(),
        output.data()
      )
    };

    auto result = emscripten::val::global("Float64Array").new_(output.size());
    result.call<void>("set", view);

    return result;
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
    string field
  ) {
    vtkNew<vtkSphereSource> sphere;
    sphere->SetCenter(centerX, centerY, centerZ);
    sphere->SetRadius(radius);
    sphere->SetPhiResolution(resolution);
    sphere->SetThetaResolution(resolution);

    grid->GetPointData()->SetActiveVectors(field.c_str());

    streamer->SetInputData(grid);
    streamer->SetSourceConnection(sphere->GetOutputPort());
    streamer->SetMaximumPropagation(length);
    streamer->SetInitialIntegrationStep(.5);
    streamer->SetMinimumIntegrationStep(.1);
    streamer->Update();

    streamTube->SetInputConnection(streamer->GetOutputPort());
    streamTube->SetInputArrayToProcess(
      1, 0, 0, vtkDataObject::FIELD_ASSOCIATION_POINTS, "vectors");
    streamTube->SetRadius(tubeRadius);
    streamTube->SetNumberOfSides(tubeSides);
    streamTube->SetVaryRadiusToVaryRadiusByVector();
    streamTube->Update();

    polydata = streamTube->GetOutput();

    polyDataWriter->SetInputConnection(streamTube->GetOutputPort());
    polyDataWriter->WriteToOutputStringOn();
    polyDataWriter->Write();
    
    return polyDataWriter->GetOutputString();
  }

  emscripten::val scalarBarRange(int componentIndex = -1) {
    std::string arrayName = polyDataMapper->GetArrayName();
    double* range = polydata->GetPointData()->GetArray(arrayName.c_str())->GetRange(componentIndex);
    return emscripten::val::array(std::vector<double>({range[0], range[1]}));
  }

  emscripten::val render(string component, string field, int componentIndex = -1,
                         double minValue = 0, double maxValue = 0) {
    vtkNew<vtkLookupTable> colorLookupTable;
    colorLookupTable->SetHueRange(0.667, 0.0);

    if (component == "surface") {
        geometryFilter->SetInputData(grid);
        geometryFilter->Update();
        polydata = geometryFilter->GetOutput();
    } else if (component == "plane") {
        cutter->SetInputData(grid);
        cutter->Update();
        polydata = cutter->GetOutput();
    } else if (component == "streamlines") {
        streamTube->GetOutput();
        streamTube->Update();
        polydata = streamTube->GetOutput();
    } else {
        // TODO:
    }

    polydata->GetPointData()->SetActiveScalars(field.c_str());
    polyDataMapper->SetScalarModeToUsePointFieldData();

    if (componentIndex == -1) {
      colorLookupTable->SetVectorModeToMagnitude();
      polyDataMapper->SelectColorArray(field.c_str());
    }
    else {
      colorLookupTable->SetVectorModeToComponent();
      colorLookupTable->SetVectorComponent(componentIndex);
      polyDataMapper->SelectColorArray(field.c_str());
    }

    colorLookupTable->Build();

    polyDataMapper->SetLookupTable(colorLookupTable);
    polyDataMapper->SetInputData(polydata);
    polyDataMapper->Update();

    if (minValue == 0 && maxValue == 0) {
        double* range = polydata->GetPointData()->GetArray(field.c_str())->GetRange(componentIndex);
        polyDataMapper->SetScalarRange(range);
    }
    else {
        polyDataMapper->SetScalarRange(minValue, maxValue);
    }

    renderer->AddActor(actor);
    renderer->ResetCamera();

    actor->GetMapper()->MapScalars(polydata, 1.0);

    unsigned char *dataPointer = polyDataMapper->GetColorMapColors()->GetPointer(0);
    int dataSize = polyDataMapper->GetColorMapColors()->GetNumberOfTuples() * actor->GetMapper()->GetColorMapColors()->GetNumberOfComponents();
    std::vector<double> data(dataPointer, dataPointer + dataSize);

    std::transform(data.begin(), data.end(), data.begin(), [](double value) {
        return value / 255.0;
    });

    emscripten::val view {
      emscripten::typed_memory_view(
        data.size(),
        data.data()
      )
    };

    auto result = emscripten::val::global("Float32Array").new_(data.size());
    result.call<void>("set", view);

    //renderer->RemoveActor(actor);
    //renderer->RemoveAllViewProps();

    return result;
  }
  
  virtual void removeAllActors() {
    renderer->GetActors()->RemoveAllItems();
  }

  virtual string exporter() {
    polyDataMapper->SetInputData(polydata);
    actor->SetMapper(polyDataMapper);
    renderer->AddActor(actor);
    renderWindow->AddRenderer(renderer);
    gltfExporter->InlineDataOn();
    // renderWindow->Render();
    gltfExporter->SetRenderWindow(renderWindow);
   
    // renderer->RemoveActor(actor);

    return gltfExporter->WriteToString();
  }

  virtual void initScene() {
    polyDataMapper->SetInputData(geometryFilter->GetOutput());
    polyDataMapper->ScalarVisibilityOn();
    polyDataMapper->SetScalarModeToUsePointData();
    polyDataMapper->SetColorModeToMapScalars();
    
    actor->SetMapper(polyDataMapper);
    // renderer->AddActor(actor);

    renderWindow->AddRenderer(renderer);
  }

  virtual void clearVTK() {
    grid->Delete();
    unstructuredGridWriter->Delete();
    actor->Delete();
    dynPlane->Delete();
    cutter->Delete();
    geometryFilter->Delete();
    polydata->Delete();
    polyDataMapper->Delete();
    streamer->Delete();
    streamTube->Delete();
    gltfExporter->Delete();
    objExporter->Delete();
    renderWindow->Delete();
    renderer->Delete();
  };

  int nCells;
  vector<double> fieldVectorVector;
  vector<double> fieldScalarVector;
  vtkSmartPointer<vtkUnstructuredGrid> grid =
    vtkSmartPointer<vtkUnstructuredGrid>::New();
  vtkSmartPointer<vtkXMLUnstructuredGridWriter> unstructuredGridWriter =
    vtkSmartPointer<vtkXMLUnstructuredGridWriter>::New();
  vtkSmartPointer<vtkActor> actor =
    vtkSmartPointer<vtkActor>::New();
  vtkSmartPointer<vtkPlane> dynPlane =
    vtkSmartPointer<vtkPlane>::New();
  vtkSmartPointer<vtkCutter> cutter =
    vtkSmartPointer<vtkCutter>::New();
  vtkSmartPointer<vtkGeometryFilter> geometryFilter =
    vtkSmartPointer<vtkGeometryFilter>::New();
  vtkSmartPointer<vtkPolyData> polydata =
    vtkSmartPointer<vtkPolyData>::New();
  vtkSmartPointer<vtkPolyDataMapper> polyDataMapper =
    vtkSmartPointer<vtkPolyDataMapper>::New();
  vtkSmartPointer<vtkXMLPolyDataWriter> polyDataWriter =
    vtkSmartPointer<vtkXMLPolyDataWriter>::New();
  vtkSmartPointer<vtkStreamTracer> streamer =
    vtkSmartPointer<vtkStreamTracer>::New();
  vtkSmartPointer<vtkTubeFilter> streamTube =
    vtkSmartPointer<vtkTubeFilter>::New();
  vtkSmartPointer<vtkGLTFExporter> gltfExporter =
    vtkSmartPointer<vtkGLTFExporter>::New();
  vtkSmartPointer<vtkOBJExporter> objExporter =
    vtkSmartPointer<vtkOBJExporter>::New();
  vtkSmartPointer<vtkRenderWindow> renderWindow =
    vtkSmartPointer<vtkRenderWindow>::New();
  vtkSmartPointer<vtkRenderer> renderer =
    vtkSmartPointer<vtkRenderer>::New();

private:
};

#endif // VTK_H
