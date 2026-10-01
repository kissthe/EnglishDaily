'use client';
import {ThemeProvider,useTheme} from 'next-themes';
import {Moon,Sun} from 'lucide-react';
import {useEffect,useState} from 'react';
export function AppTheme({children}:{children:React.ReactNode}){return <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="english-daily-theme"><ThemeToggle/>{children}</ThemeProvider>}
function ThemeToggle(){const {resolvedTheme,setTheme}=useTheme(),[mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const dark=mounted&&resolvedTheme==='dark';return <button className="theme-toggle" aria-label={dark?'切换到日间模式':'切换到黑夜模式'} title={dark?'切换到日间模式':'切换到黑夜模式'} onClick={()=>setTheme(dark?'light':'dark')}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button>}
