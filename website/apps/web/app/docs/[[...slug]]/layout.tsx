import "~/styles/prose.css";

import { NavbarMobileProvider } from "~/components/nav-mobile";

import { Navbar } from "~/components/nav-bar";
import { Sidebar } from "~/components/side-bar";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="font-calling-code pt-16">
      <NavbarMobileProvider>
        <Navbar />
        <main className="relative flex grow flex-row">
          <div className="md:mr-[268px] lg:mr-[286px]">
            <Sidebar />
          </div>
          {children}
        </main>
      </NavbarMobileProvider>
    </div>
  );
}
