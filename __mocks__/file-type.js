// Manual CJS mock for file-type (ESM-only package)
// Default: return a valid JPEG detection to let most tests pass through
let _mockResult = { mime: "image/jpeg", ext: "jpg" };

module.exports = {
  fileTypeFromBuffer: jest.fn().mockImplementation(async () => _mockResult),
  __setMockResult: (result) => {
    _mockResult = result;
    module.exports.fileTypeFromBuffer.mockResolvedValue(result);
  },
};
