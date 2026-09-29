require "language/node"

class Lazycommit < Formula
  desc "Writes your git commit messages for you with AI using Groq"
  homepage "https://github.com/KartikLabhshetwar/lazycommit"
  url "https://registry.npmjs.org/lazycommitt/-/lazycommitt-2.0.1.tgz"
  sha256 "00d8b99f14325708c7f2ce2a22b3263d22cabccea8a6c03c62588574aa68f5a1"
  license "Apache-2.0"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/lazycommit --version")
  end
end


