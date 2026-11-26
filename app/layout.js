import './globals.css';

export const metadata = { title: 'IK Partner Outreach', description: 'Partner list, Gmail drafts and daily progress' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
