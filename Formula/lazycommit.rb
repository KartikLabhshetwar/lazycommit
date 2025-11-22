require "language/node"

class Lazycommit < Formula
  desc "Writes your git commit messages for you with AI using Groq"
  homepage "https://github.com/KartikLabhshetwar/lazycommit"
  url "https://registry.npmjs.org/lazycommitt/-/lazycommitt-1.0.19.tgz"
  sha256 "e685b2b9de8627ce7493c72ae6f7538ec5b72048ddefa2c94a9ebaf2bb6aacc4"
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


