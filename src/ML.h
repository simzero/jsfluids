// Author: Carlos Peña-Monferrer (SIMZERO) - 2023

#ifndef ML_H
#define ML_H

#include <stdlib.h>
#include <string>
#include <fstream>
#include <sstream>
#include <list>
#include <vector>

#include <VTK.cc>

#include <vtkCellCenters.h> 
#include <vtkImplicitPolyDataDistance.h>


using namespace std;

class ML : public VTK {
  public:
    ML() {}

    emscripten::val fieldVector() {
      return emscripten::val(
        emscripten::typed_memory_view(
          3*nCells,
          fieldVectorVector.data()
        )
      );
    }

    emscripten::val fieldScalar() {
      return emscripten::val(
        emscripten::typed_memory_view(
          nCells,
          fieldVectorVector.data()
        )
      );
    }

    auto update(string fieldName, int components) {
      vtkNew<vtkDoubleArray> array;
      array->SetName(fieldName.c_str());
      array->SetNumberOfComponents(components);
      array->SetNumberOfTuples(fieldVectorVector.size() / components);

      for( vtkIdType i = 0; i < nCells; i++ )
      {
        if (components == 3) {
          array->SetTuple3(
            i,
            fieldVectorVector[i],
            fieldVectorVector[i + nCells],
            fieldVectorVector[i + 2*nCells]
          );
        }
        if (components == 3) {
          array->SetTuple3(
            i,
            fieldVectorVector[i],
            fieldVectorVector[i + nCells],
            fieldVectorVector[i + 2*nCells]
          );
        }
      }

      // velocity->SetArray(UVector.data(), UVector.size(), 0);

      grid->GetCellData()->AddArray(array);

      vtkNew<vtkCellDataToPointData> cellToPoint;
      cellToPoint->ProcessAllArraysOn();
      cellToPoint->PassCellDataOn();
      cellToPoint->SetInputData(grid);
      cellToPoint->Update();

      grid = cellToPoint->GetUnstructuredGridOutput();
    }

    auto computeSDFAndRegion(string const& buffer) {
      vtkNew<vtkXMLPolyDataReader> vtkReader;
      vtkReader->ReadFromInputStringOn();
      vtkReader->SetInputString(buffer);
      vtkReader->Update();

      vtkNew<vtkImplicitPolyDataDistance> implicitPolyDataDistance;
      implicitPolyDataDistance->SetInput(vtkReader->GetOutput());

      vtkNew<vtkDoubleArray> sdf1;
      sdf1->SetNumberOfComponents(1);
      sdf1->SetName("sdf1");
      sdf1->SetNumberOfTuples(nCells);

      vtkDataArray* flowRegionData = grid->GetCellData()->GetArray("flowRegion");
      vtkDataArray* sdf2Data = grid->GetCellData()->GetArray("sdf2");

      int nCellsOutput = grid->GetNumberOfCells();
      vector<double> output(nCellsOutput * 3);

      vtkNew<vtkCellCenters> cellCentersFilter;
      cellCentersFilter->SetInputData(grid);
      cellCentersFilter->VertexCellsOn();
      cellCentersFilter->Update();

      for (vtkIdType cellId = 0; cellId < nCellsOutput; ++cellId)
      {
        double flowRegionValue = flowRegionData->GetTuple1(cellId);
        double sdf2RegionValue = sdf2Data->GetTuple1(cellId);
        double p[3];

        cellCentersFilter->GetOutput()->GetPoint(cellId, p);
        double signedDistance = implicitPolyDataDistance->EvaluateFunction(p);
      
        if(signedDistance < 0)
        {
          flowRegionValue = 0;
        }
        
        sdf1->SetTuple1(cellId, signedDistance);

        output.at(cellId + nCellsOutput) = flowRegionValue;
        output.at(cellId) = signedDistance;
        output.at(cellId + nCellsOutput * 2) = sdf2RegionValue;
      }

      grid->GetCellData()->SetScalars(sdf1);
    
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

    #include "common.h"


    virtual string stlToVtp(string const& buffer) {
      return VTK::stlToVtp(buffer);
    }
};

#endif // ML_H
