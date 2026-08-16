import "./globals.css"; import type { Metadata } from "next";
export const metadata: Metadata={title:"BRC | Pro Platform",description:"Logistics operations"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
