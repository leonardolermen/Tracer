Gem::Specification.new do |spec|
  spec.name          = "traceflow-sdk"
  spec.version       = "0.1.0"
  spec.authors       = ["TraceFlow"]
  spec.summary       = "TraceFlow Ruby SDK"
  spec.description   = "Official Ruby SDK for TraceFlow, including Rack middleware."
  spec.homepage      = "https://github.com/traceflow/sdk-ruby"
  spec.license       = "MIT"

  spec.files         = Dir["lib/**/*"]
  spec.require_paths = ["lib"]

  spec.add_dependency "rack", ">= 2.0"
end
