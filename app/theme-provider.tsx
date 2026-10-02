'use client';
import {ThemeProvider,useTheme} from 'next-themes';
import {Moon,Sun} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
export function AppTheme({children}:{children:React.ReactNode}){return <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="english-daily-theme"><ThemeToggle/>{children}</ThemeProvider>}
function ThemeToggle(){
  const {resolvedTheme,setTheme}=useTheme(),[mounted,setMounted]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{setMounted(true);return ()=>{clearTimeout(timer.current);document.documentElement.classList.remove('theme-changing')}},[]);
  const dark=mounted&&resolvedTheme==='dark';
  function toggle(){
    const root=document.documentElement;
    clearTimeout(timer.current);
    root.classList.add('theme-changing');
    // Establish transitions before next-themes updates the root class.
    void root.offsetWidth;
    setTheme(dark?'light':'dark');
    timer.current=setTimeout(()=>root.classList.remove('theme-changing'),350);
  }
  return <button className="theme-toggle" aria-label={dark?'切换到日间模式':'切换到黑夜模式'} title={dark?'切换到日间模式':'切换到黑夜模式'} onClick={toggle} disabled={!mounted}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button>
}
