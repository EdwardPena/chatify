// How to make animated gradient border 👇
// https://cruip-tutorials.vercel.app/animated-gradient-border/
function BorderAnimatedContainer({ children }) {
  return (
    <div className="w-full h-full [background:linear-gradient(45deg,#151925,#1c2231_50%,#151925)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.slate.700/.48)_80%,_#6366f1_86%,_#a5b4fc_90%,_#6366f1_94%,_theme(colors.slate.700/.48))_border-box] rounded-2xl border border-transparent animate-border  flex overflow-hidden">
      {children}
    </div>
  );
}
export default BorderAnimatedContainer;
