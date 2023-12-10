#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <dirent.h>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <sys/stat.h>
#include <sys/types.h>
#include <unordered_map>
#include <utility>
#include <vector>

#ifdef WEB_BUILD
// Building with the itk.js docker container has a more recent gcc version
#include <filesystem>
namespace fs = std::filesystem;
#else
// Building locally with gcc 7.5.0 means I need -lstdc++fs and
// experimental/filesystem
#include <experimental/filesystem>
namespace fs = std::experimental::filesystem;
#endif

#ifdef WEB_BUILD
#include <emscripten.h>
#endif

#include <fstream>
#include <iostream>
#include <nlohmann/json.hpp>

#include "itkCastImageFilter.h"
#include "itkGDCMImageIO.h"
#include "itkGDCMSeriesFileNames.h"
#include "itkImage.h"
#include "itkImageFileReader.h"
#include "itkImageIOBase.h"
#include "itkImageSeriesReader.h"
#include "itkRescaleIntensityImageFilter.h"
#include "itkVectorImage.h"

#include "itkOutputImage.h"
#include "itkOutputTextStream.h"
#include "itkPipeline.h"

#include "gdcmImageHelper.h"
#include "gdcmReader.h"

using json = nlohmann::json;
using ImageType = itk::Image<float, 3>;
using ReaderType = itk::ImageFileReader<ImageType>;
using FileNamesContainer = std::vector<std::string>;
using DicomIO = itk::GDCMImageIO;
// volumeID -> filenames[]
using VolumeMapType = std::unordered_map<std::string, std::vector<std::string>>;

static const double EPSILON = 10e-5;

#ifdef WEB_BUILD
extern "C" const char *EMSCRIPTEN_KEEPALIVE unpack_error_what(intptr_t ptr) {
  auto error = reinterpret_cast<std::runtime_error *>(ptr);
  return error->what();
}
#endif

/**
 * @brief Splits and sorts DICOM files into reconstructable volumes.
 *
 * @param pipeline
 * @return int
 */
int splitAndSortDicomFiles(itk::wasm::Pipeline &pipeline) {
  // inputs
  FileNamesContainer files;
  pipeline
      .add_option("-f,--files", files,
                  "File names to categorize. Must be all unique.")
      ->required()
      ->check(CLI::ExistingFile)
      ->expected(1, -1);

  // std::vector<std::string> restrictions;
  // pipeline
  //     .add_option("-r,--restrictions", restrictions,
  //                 "Extra DICOM restrictions. GGGG|EEEE format, in
  //                 hexadecimal.")
  //     ->expected(0, -1);

  // outputs
  itk::wasm::OutputTextStream volumeMapJSONStream;
  pipeline
      .add_option("volumeMap", volumeMapJSONStream,
                  "JSON object encoding volumeID => filenames.")
      ->required();

  ITK_WASM_PARSE(pipeline);

  std::string path = "./";

  // parse out series
  typedef itk::GDCMSeriesFileNames SeriesFileNames;
  SeriesFileNames::Pointer seriesFileNames = SeriesFileNames::New();
  // files are all default dumped to cwd
  seriesFileNames->SetDirectory(path);
  seriesFileNames->SetUseSeriesDetails(true);
  seriesFileNames->SetGlobalWarningDisplay(false);
  seriesFileNames->AddSeriesRestriction("0008|0021");
  // for (auto &restriction : restrictions) {
  //   seriesFileNames->AddSeriesRestriction(restriction);
  // }
  seriesFileNames->SetRecursive(false);
  // Does this affect series organization?
  seriesFileNames->SetLoadPrivateTags(false);

  // Obtain the separation of imported files into distinct volumes.
  auto &gdcmSeriesUIDs = seriesFileNames->GetSeriesUIDs();

  VolumeMapType volumeMap;
  for (auto seriesUID : gdcmSeriesUIDs) {
    volumeMap[seriesUID] = seriesFileNames->GetFileNames(seriesUID.c_str());
  }

  // strip off tmp prefix
  for (auto &entry : volumeMap) {
    auto &fileNames = entry.second;
    for (auto &f : fileNames) {
      f = f.substr(path.size());
    }
  }

  // Generate the JSON and add to output stream
  auto volumeMapJSON = json(volumeMap);
  volumeMapJSONStream.Get() << volumeMapJSON;

  // Clean up files
  for (auto &file : files) {
    remove(file.c_str());
  }

  return EXIT_SUCCESS;
}

/**
 * Reads an image slice and returns the optionally thumbnailed image.
 */
int getSliceImage(itk::wasm::Pipeline &pipeline) {

  // inputs
  std::string fileName;
  pipeline.add_option("-f,--file", fileName, "File name generate image for")
      ->required()
      ->check(CLI::ExistingFile)
      ->expected(1);

  bool asThumbnail = false;
  pipeline.add_option("-t,--thumbnail", asThumbnail,
                      "Generate thumbnail image");

  ITK_WASM_PRE_PARSE(pipeline);

  // Setup reader
  typename DicomIO::Pointer dicomIO = DicomIO::New();
  dicomIO->LoadPrivateTagsOff();
  typename ReaderType::Pointer reader = ReaderType::New();
  reader->SetFileName(fileName);

  if (asThumbnail) {
    using InputImageType = ImageType;
    using OutputPixelType = uint8_t;
    using OutputImageType = itk::Image<OutputPixelType, 3>;
    using RescaleFilter =
        itk::RescaleIntensityImageFilter<InputImageType, InputImageType>;
    using CastImageFilter =
        itk::CastImageFilter<InputImageType, OutputImageType>;

    // outputs
    using WasmOutputImageType = itk::wasm::OutputImage<OutputImageType>;
    WasmOutputImageType outputImage;
    pipeline.add_option("OutputImage", outputImage, "The slice")->required();

    ITK_WASM_PARSE(pipeline);

    auto rescaleFilter = RescaleFilter::New();
    rescaleFilter->SetInput(reader->GetOutput());
    rescaleFilter->SetOutputMinimum(0);
    rescaleFilter->SetOutputMaximum(itk::NumericTraits<OutputPixelType>::max());

    auto castFilter = CastImageFilter::New();
    castFilter->SetInput(rescaleFilter->GetOutput());
    castFilter->Update();

    // Set the output image
    outputImage.Set(castFilter->GetOutput());
  } else {
    // outputs
    using WasmOutputImageType = itk::wasm::OutputImage<ImageType>;
    WasmOutputImageType outputImage;
    pipeline.add_option("OutputImage", outputImage, "The slice")->required();

    ITK_WASM_PARSE(pipeline);

    reader->Update();
    outputImage.Set(reader->GetOutput());
  }

  // Clean up the file
  remove(fileName.c_str());

  return EXIT_SUCCESS;
}

int main(int argc, char *argv[]) {
  std::string action;
  itk::wasm::Pipeline pipeline(
      "DICOM-VolView", "VolView pipeline to access DICOM data", argc, argv);
  pipeline.add_option("-a,--action", action, "The action to run")
      ->check(CLI::IsMember({"categorize", "getSliceImage"}));

  // Pre parse so we can get the action
  ITK_WASM_PRE_PARSE(pipeline)

  if (action == "splitAndSort") {

    ITK_WASM_CATCH_EXCEPTION(pipeline, splitAndSortDicomFiles(pipeline));

  } else if (action == "getSliceImage") {

    ITK_WASM_CATCH_EXCEPTION(pipeline, getSliceImage(pipeline));
  }

  return EXIT_SUCCESS;
}
