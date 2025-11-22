require "language/node"

class Lazycommit < Formula
  desc "Writes your git commit messages for you with AI using Groq"
  homepage "https://github.com/KartikLabhshetwar/lazycommit"
  url "https://registry.npmjs.org/lazycommitt/-/lazycommitt-1.0.18.tgz"
  sha256 "729ef3f3e33de4c4a596700e6c594aed2c39a03524ace1a9b13453d5811d2c7d"
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


