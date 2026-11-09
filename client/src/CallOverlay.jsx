import { useEffect, useRef } from "react";
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Video } from "lucide-react";

export default function CallOverlay({
  call,
  localStream,
  remoteStream,
  muted,
  cameraEnabled,
  quality,
  callError,
  onAnswer,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onDismissError,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  return <>
    {!call && callError && <div className="call-toast" role="status">{callError}<button type="button" onClick={onDismissError}>Dismiss</button></div>}
    {call && <div className="call-backdrop">
      <section className={`call-panel ${call.video ? "video-call" : "audio-call"}`} role="dialog" aria-modal="true" aria-label={`${call.video ? "Video" : "Audio"} call with ${call.peerName}`}>
        <header className="call-header">
          <div><strong>{call.peerName}</strong><span>{call.status === "incoming" ? `Incoming ${call.video ? "video" : "audio"} call` : call.status === "calling" ? "Calling…" : call.status === "connected" ? `${call.video ? "Video" : "Audio"} call · ${quality} connection` : "Connecting…"}</span></div>
          {call.status === "connected" && <span className={`call-quality quality-${quality.toLowerCase()}`}>{quality}</span>}
        </header>
        <div className="call-stage">
          {remoteStream && call.video
            ? <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
            : <div className="call-avatar"><Video size={30} /><strong>{call.peerName}</strong><span>{remoteStream ? "Audio connected" : call.status === "incoming" ? "Wants to talk with you" : call.status === "calling" ? "Waiting for an answer" : "Establishing a secure connection"}</span></div>}
          {!call.video && <audio ref={remoteAudioRef} autoPlay />}
          {call.video && <video ref={localVideoRef} className={`local-video ${!cameraEnabled ? "camera-off" : ""}`} autoPlay muted playsInline />}
        </div>
        {callError && <p className="call-inline-error" role="alert">{callError}</p>}
        <footer className="call-controls">
          {call.status === "incoming" ? <>
            <button type="button" className="call-control reject-control" onClick={onReject} aria-label="Decline call"><PhoneOff size={20} /><span>Decline</span></button>
            <button type="button" className="call-control answer-control" onClick={onAnswer} aria-label="Answer call"><Phone size={20} /><span>Answer</span></button>
          </> : <>
            <button type="button" className={`call-control ${muted ? "control-active" : ""}`} onClick={onToggleMute} disabled={!localStream} aria-label={muted ? "Unmute microphone" : "Mute microphone"}><span className="control-icon">{muted ? <MicOff size={19} /> : <Mic size={19} />}</span><span>{muted ? "Unmute" : "Mute"}</span></button>
            {call.video && <button type="button" className={`call-control ${!cameraEnabled ? "control-active" : ""}`} onClick={onToggleCamera} disabled={!localStream} aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}><span className="control-icon">{cameraEnabled ? <Camera size={19} /> : <CameraOff size={19} />}</span><span>{cameraEnabled ? "Camera" : "Camera off"}</span></button>}
            <button type="button" className="call-control reject-control" onClick={onEnd} aria-label="End call"><PhoneOff size={20} /><span>End call</span></button>
          </>}
        </footer>
      </section>
    </div>}
  </>;
}
