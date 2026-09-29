require "language/node"

class Lazycommit < Formula
  desc "Writes your git commit messages for you with AI"
  homepage "https://github.com/KartikLabhshetwar/lazycommit"
  url "https://registry.npmjs.org/lazycommitt/-/lazycommitt-3.0.0.tgz"
  sha256 "139b975be691e580c71ea49f621bccff52e2896194051afa433ccf33ce224e4f"
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


