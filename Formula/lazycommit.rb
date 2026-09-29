require "language/node"

class Lazycommit < Formula
  desc "Writes your git commit messages for you with AI"
  homepage "https://github.com/KartikLabhshetwar/lazycommit"
  url "https://registry.npmjs.org/lazycommitt/-/lazycommitt-3.1.0.tgz"
  sha256 "9dbf9ea4df6441674a2af762cc626e4f993b8ef753e33718a1ae6e59c0217ae9"
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


