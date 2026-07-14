import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { zhCN } from "../../i18n/strings";
import { analyzeMedia, type MediaAnalysis } from "../../lib/tauri-bridge";
import type { MediaAsset } from "@open-factory/editor-core";

interface MediaMetadataPanelProps { asset: MediaAsset | null; }
const analysisCache = new Map<string, MediaAnalysis>();
function formatCodec(a: MediaAsset): string { return a.videoCodec ?? a.audioCodec ?? "—"; }
function formatBitRateDisplay(b?: number): string { if(!b||!Number.isFinite(b))return"—"; if(b>=1e6)return(b/1e6).toFixed(2)+" Mbps"; if(b>=1e3)return(b/1e3).toFixed(1)+" kbps"; return Math.round(b)+" bps"; }
function formatFileSizeDisplay(bytes?: number): string { if(!bytes||!Number.isFinite(bytes))return"—"; const u=["B","KB","MB","GB","TB"];let v=bytes,i=0;while(v>=1024&&i<u.length-1){v/=1024;i++;}return v.toFixed(i===0?0:1)+" "+u[i]; }
function formatDurationDisplay(s?: number): string { if(!s||!Number.isFinite(s))return"—"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); if(h>0)return h+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0"); return m+":"+String(sec).padStart(2,"0"); }
function formatFrameRateDisplay(fr?: number): string { if(!fr||!Number.isFinite(fr))return"—"; const r=Math.round(fr*100)/100; return(Number.isInteger(r)?String(r):r.toFixed(2).replace(/0+$/,"").replace(/\.$/,""))+" fps"; }
function MR({label,value,testId}:{label:string;value:string;testId?:string}){ return <div className="flex items-baseline justify-between gap-2 py-0.5" data-testid={testId}><span className="flex-shrink-0 text-[11px] text-[var(--color-text-muted)]">{label}</span><span className="truncate text-right text-xs font-medium text-ink" title={value}>{value}</span></div>; }
function SH({children}:{children:React.ReactNode}){ return <h4 className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] first:mt-0">{children}</h4>; }
export function MediaMetadataPanel({asset}:MediaMetadataPanelProps){
  const[a,setA]=useState<MediaAnalysis|null>(null);const[l,setL]=useState(false);const[e,setE]=useState<string|null>(null);
  const load=useCallback(async(p:string)=>{const c=analysisCache.get(p);if(c){setA(c);return;}setL(true);setE(null);try{const r=await analyzeMedia(p);analysisCache.set(p,r);setA(r);}catch(err){setE(err instanceof Error?err.message:String(err));}finally{setL(false);}},[]);
  useEffect(()=>{if(!asset){setA(null);setE(null);return;}const c=analysisCache.get(asset.path);if(c){setA(c);return;}const t=setTimeout(()=>load(asset.path),150);return()=>clearTimeout(t);},[asset?.path,load]);
  if(!asset)return<div className="flex h-full items-center justify-center p-4 text-center text-xs text-[var(--color-text-muted)]" data-testid="metadata-panel-empty">{zhCN.mediaBin.metadataPanel.noSelection}</div>;
  const vs=a?.videoStreams[0];const as=a?.audioStreams[0];
  return(<div className="h-full overflow-y-auto p-3 text-xs" data-testid="metadata-panel">
    <h3 className="mb-2 text-sm font-semibold text-ink">{zhCN.mediaBin.metadataPanel.title}</h3>
    <div className="truncate text-[11px] text-[var(--color-text-muted)]" title={asset.path}>{asset.name}</div>
    <SH>{zhCN.mediaBin.metadataPanel.basic}</SH>
    <MR label={zhCN.mediaBin.metadataPanel.codec} value={formatCodec(asset)} testId="metadata-codec"/>
    {asset.type!=="audio"&&<MR label={zhCN.mediaBin.metadataPanel.resolution} value={asset.width&&asset.height?asset.width+" × "+asset.height:"—"} testId="metadata-resolution"/>}
    {asset.frameRate&&<MR label={zhCN.mediaBin.metadataPanel.frameRate} value={formatFrameRateDisplay(asset.frameRate)} testId="metadata-frame-rate"/>}
    <MR label={zhCN.mediaBin.metadataPanel.duration} value={formatDurationDisplay(asset.duration)} testId="metadata-duration"/>
    {l&&<div className="my-3 flex items-center gap-2 text-[var(--color-text-muted)]"><Loader2 className="animate-spin" size={14}/><span>{zhCN.mediaBin.metadataPanel.loading}</span></div>}
    {e&&<div className="my-3 flex items-center gap-2 text-red-500"><AlertCircle size={14}/><span>{zhCN.mediaBin.metadataPanel.error}</span></div>}
    {vs&&<><SH>{zhCN.mediaBin.metadataPanel.videoStream}</SH>
      <MR label={zhCN.mediaBin.metadataPanel.codec} value={vs.codecLongName??vs.codecName??"—"} testId="metadata-video-codec"/>
      {vs.pixelFormat&&<MR label={zhCN.mediaBin.metadataPanel.pixelFormat} value={vs.pixelFormat} testId="metadata-pixel-format"/>}
      {vs.bitRate&&<MR label={zhCN.mediaBin.metadataPanel.bitRate} value={formatBitRateDisplay(vs.bitRate)} testId="metadata-video-bitrate"/>}
      {vs.colorSpace&&<MR label={zhCN.mediaBin.metadataPanel.colorSpace} value={vs.colorSpace} testId="metadata-color-space"/>}
    </>}
    {as&&<><SH>{zhCN.mediaBin.metadataPanel.audioStream}</SH>
      <MR label={zhCN.mediaBin.metadataPanel.codec} value={as.codecLongName??as.codecName??"—"} testId="metadata-audio-codec"/>
      {as.sampleRate&&<MR label={zhCN.mediaBin.metadataPanel.sampleRate} value={as.sampleRate+" Hz"} testId="metadata-sample-rate"/>}
      {as.channels&&<MR label={zhCN.mediaBin.metadataPanel.channels} value={String(as.channels)} testId="metadata-channels"/>}
    </>}
    {a&&<><SH>{zhCN.mediaBin.metadataPanel.fileInfo}</SH>
      {a.format.formatLongName&&<MR label={zhCN.mediaBin.metadataPanel.formatName} value={a.format.formatLongName} testId="metadata-format-name"/>}
      <MR label={zhCN.mediaBin.metadataPanel.fileSize} value={formatFileSizeDisplay(a.fileSize??asset.size)} testId="metadata-file-size"/>
    </>}
  </div>);
}
