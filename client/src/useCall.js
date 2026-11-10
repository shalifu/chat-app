import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const QUALITY_PROFILES = {
  Excellent: { maxBitrate: 2500000, scale: 1, frameRate: 30 },
  Good: { maxBitrate: 900000, scale: 1.5, frameRate: 24 },
  Weak: { maxBitrate: 350000, scale: 2, frameRate: 15 },
};

function initialQuality() {
  const downlink = navigator.connection?.downlink;
  const effectiveType = navigator.connection?.effectiveType;
  if ((typeof downlink === "number" && downlink < 1) || effectiveType === "2g" || effectiveType === "slow-2g") {
    return "Weak";
  }
  if ((typeof downlink === "number" && downlink < 2) || effectiveType === "3g") return "Good";
  return "Excellent";
}

function mediaAccessError(error, video) {
  const errorName = error?.name || "";
  const errorMessage = error?.message?.toLowerCase() || "";
  if (
    errorName === "NotAllowedError" ||
    errorName === "PermissionDeniedError" ||
    errorName === "SecurityError" ||
    errorMessage.includes("permission denied")
  ) {
    if (!window.isSecureContext) {
      return "Calls require a secure HTTPS connection. Open the chat using its HTTPS address, or use localhost for development.";
    }
    return `Allow ${video ? "microphone and camera" : "microphone"} access for this site in your browser and device settings, then try again.`;
  }
  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return `No ${video ? "microphone or camera" : "microphone"} was found. Connect or enable a device, then try again.`;
  }
  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return "Your microphone or camera is busy or unavailable. Close other apps using it, then try again.";
  }
  return error?.message || "Could not access your microphone or camera.";
}

export default function useCall(socket, token, onIncomingCall) {
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [quality, setQuality] = useState("Excellent");
  const [callError, setCallError] = useState("");
  const callRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const outgoingCandidatesRef = useRef([]);
  const outgoingSignalReadyCallIdRef = useRef(null);
  const qualityTimerRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const onIncomingCallRef = useRef(onIncomingCall);
  onIncomingCallRef.current = onIncomingCall;

  const publishCall = useCallback((nextCall) => {
    callRef.current = nextCall;
    setCall(nextCall);
  }, []);

  const stopMedia = useCallback(() => {
    if (qualityTimerRef.current) window.clearInterval(qualityTimerRef.current);
    qualityTimerRef.current = null;
    if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    outgoingCandidatesRef.current = [];
    outgoingSignalReadyCallIdRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraEnabled(true);
    setQuality("Excellent");
  }, []);

  const endCall = useCallback((notifyPeer = true) => {
    const activeCall = callRef.current;
    if (notifyPeer && activeCall && socket?.connected) {
      socket.emit("call:end", { callId: activeCall.callId });
    }
    stopMedia();
    publishCall(null);
  }, [publishCall, socket, stopMedia]);

  const loadIceServers = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/calls/ice-servers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned invalid call network settings.");
    }
    if (!response.ok || !Array.isArray(data.iceServers) || data.iceServers.length === 0) {
      throw new Error(data.message || "Could not load call network settings.");
    }
    return data.iceServers;
  }, [token]);

  const createPeerConnection = useCallback((activeCall, iceServers) => {
    const connection = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 });
    peerConnectionRef.current = connection;
    localStreamRef.current?.getTracks().forEach((track) => connection.addTrack(track, localStreamRef.current));
    connection.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) setRemoteStream(stream);
    };
    connection.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        if (activeCall.incoming || outgoingSignalReadyCallIdRef.current === activeCall.callId) {
          socket.emit("call:candidate", { callId: activeCall.callId, candidate: event.candidate });
        } else {
          outgoingCandidatesRef.current.push(event.candidate);
        }
      }
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "connected") {
        if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
        setCallError("");
        publishCall({ ...callRef.current, status: "connected" });
      } else if (connection.connectionState === "failed") {
        setCallError("Could not establish the call. Check both internet connections; this network may require a TURN relay.");
        endCall();
      }
    };
    qualityTimerRef.current = window.setInterval(async () => {
      if (connection.connectionState !== "connected") return;
      try {
        const stats = await connection.getStats();
        let roundTripTime = 0;
        let packetLoss = 0;
        let availableBitrate = Number.POSITIVE_INFINITY;
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) {
            roundTripTime = report.currentRoundTripTime || 0;
            if (typeof report.availableOutgoingBitrate === "number") {
              availableBitrate = report.availableOutgoingBitrate;
            }
          }
          if (report.type === "remote-inbound-rtp" && report.kind === "video") {
            const received = report.packetsReceived || 0;
            const lost = report.packetsLost || 0;
            packetLoss = received + lost > 0 ? lost / (received + lost) : 0;
          }
        });
        const nextQuality = roundTripTime > 0.35 || packetLoss > 0.08 || availableBitrate < 500000
          ? "Weak"
          : roundTripTime > 0.18 || packetLoss > 0.03 || availableBitrate < 1200000
            ? "Good"
            : "Excellent";
        setQuality(nextQuality);
        const videoSender = connection.getSenders().find((sender) => sender.track?.kind === "video");
        if (videoSender) {
          const parameters = videoSender.getParameters();
          if (parameters.encodings?.length) {
            const profile = QUALITY_PROFILES[nextQuality];
            parameters.encodings[0].maxBitrate = profile.maxBitrate;
            parameters.encodings[0].scaleResolutionDownBy = profile.scale;
            parameters.encodings[0].maxFramerate = profile.frameRate;
            await videoSender.setParameters(parameters);
          }
        }
      } catch {
        setCallError("Could not update connection-based video quality. The call will continue with its current settings.");
      }
    }, 3000);
    return connection;
  }, [endCall, publishCall, socket]);

  const prepareMedia = useCallback(async (video) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Audio and video calls require a secure connection (HTTPS) and a supported browser.");
    }
    const networkQuality = initialQuality();
    setQuality(networkQuality);
    const videoConstraints = networkQuality === "Weak"
      ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 20 } }
      : networkQuality === "Good"
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: video ? videoConstraints : false,
      });
    } catch (error) {
      throw new Error(mediaAccessError(error, video));
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const startCall = useCallback(async (person, video) => {
    if (!socket?.connected || callRef.current) return;
    setCallError("");
    let preparedStream = null;
    let publishedCall = false;
    const nextCall = {
      callId: crypto.randomUUID(),
      peerId: person.id,
      peerName: person.name,
      video,
      status: "calling",
      incoming: false,
    };
    try {
      const results = await Promise.allSettled([prepareMedia(video), loadIceServers()]);
      const mediaResult = results[0];
      const iceResult = results[1];
      if (mediaResult.status === "fulfilled") preparedStream = mediaResult.value;
      const failedResult = results.find((result) => result.status === "rejected");
      if (failedResult) throw failedResult.reason;
      const iceServers = iceResult.value;
      if (callRef.current) {
        preparedStream.getTracks().forEach((track) => track.stop());
        if (localStreamRef.current === preparedStream) {
          localStreamRef.current = null;
          setLocalStream(null);
        }
        return;
      }
      outgoingCandidatesRef.current = [];
      outgoingSignalReadyCallIdRef.current = null;
      publishCall(nextCall);
      publishedCall = true;
      createPeerConnection(nextCall, iceServers);
      const inviteResult = await new Promise((resolve, reject) => {
        socket.emit("call:invite", { callId: nextCall.callId, to: person.id, video }, (result) => {
          if (result?.ok) resolve(result);
          else reject(new Error(result?.message || "The call could not be started."));
        });
      });
      if (!inviteResult?.ok) return;
      if (callRef.current?.callId !== nextCall.callId) {
        socket.emit("call:end", { callId: nextCall.callId });
        return;
      }
      outgoingSignalReadyCallIdRef.current = nextCall.callId;
      for (const candidate of outgoingCandidatesRef.current) {
        socket.emit("call:candidate", { callId: nextCall.callId, candidate });
      }
      outgoingCandidatesRef.current = [];
    } catch (error) {
      if (callRef.current?.callId === nextCall.callId) {
        endCall();
        setCallError(error.message || "Could not access your microphone or camera.");
      } else if (preparedStream && localStreamRef.current === preparedStream) {
        preparedStream.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      if (!publishedCall && !callRef.current) {
        setCallError(error.message || "Could not access your microphone or camera.");
      }
    }
  }, [createPeerConnection, endCall, loadIceServers, prepareMedia, publishCall, socket, stopMedia]);

  const answerCall = useCallback(async () => {
    const activeCall = callRef.current;
    if (!activeCall?.incoming || activeCall.status !== "incoming" || !socket?.connected) return;
    setCallError("");
    publishCall({ ...activeCall, status: "answering" });
    let stream = null;
    try {
      const preparingPromise = new Promise((resolve, reject) => {
        socket.emit("call:preparing", { callId: activeCall.callId }, (result) => {
          if (result?.ok) resolve(result);
          else reject(new Error(result?.message || "This call is no longer available."));
        });
      });
      const mediaPromise = prepareMedia(activeCall.video);
      const iceServersPromise = loadIceServers();
      const results = await Promise.allSettled([preparingPromise, mediaPromise, iceServersPromise]);
      const preparingResult = results[0];
      const mediaResult = results[1];
      const iceServersResult = results[2];
      if (mediaResult.status === "fulfilled") stream = mediaResult.value;
      const failedResult = results.find((result) => result.status === "rejected");
      if (failedResult) throw failedResult.reason;
      if (callRef.current?.callId !== activeCall.callId) {
        stream.getTracks().forEach((track) => track.stop());
        if (localStreamRef.current === stream) {
          localStreamRef.current = null;
          setLocalStream(null);
        }
        return;
      }
      if (!preparingResult.value?.ok) throw new Error("This call is no longer available.");
      if (callRef.current?.callId !== activeCall.callId) return;
      createPeerConnection(activeCall, iceServersResult.value);
      publishCall({ ...activeCall, status: "connecting" });
      socket.emit("call:accept", { callId: activeCall.callId }, (result) => {
        if (!result?.ok) {
          setCallError(result?.message || "This call is no longer available.");
          endCall(false);
        }
      });
      if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
      const connection = peerConnectionRef.current;
      connectionTimeoutRef.current = window.setTimeout(() => {
        if (connection?.connectionState !== "connected" && callRef.current?.callId === activeCall.callId) {
          setCallError("Still connecting. Check your internet connection; restrictive networks may need a TURN relay.");
        }
      }, 15000);
    } catch (error) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        if (localStreamRef.current === stream) {
          localStreamRef.current = null;
          setLocalStream(null);
        }
      }
      if (callRef.current?.callId === activeCall.callId) {
        setCallError(error.message || mediaAccessError(error, activeCall.video));
        publishCall({ ...activeCall, status: "incoming" });
      }
    }
  }, [createPeerConnection, endCall, loadIceServers, prepareMedia, publishCall, socket]);

  const rejectCall = useCallback(() => {
    const activeCall = callRef.current;
    if (activeCall && socket?.connected) socket.emit("call:reject", { callId: activeCall.callId });
    stopMedia();
    publishCall(null);
  }, [publishCall, socket, stopMedia]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraEnabled(track.enabled);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onIncoming = (invite) => {
      if (callRef.current) {
        socket.emit("call:reject", { callId: invite.callId });
        return;
      }
      setCallError("");
      publishCall({
        callId: invite.callId,
        peerId: invite.fromId,
        peerName: invite.fromName,
        video: invite.video,
        status: "incoming",
        incoming: true,
      });
      onIncomingCallRef.current?.(invite);
    };
    const onAccepted = async ({ callId }) => {
      const activeCall = callRef.current;
      if (!activeCall || activeCall.callId !== callId || activeCall.incoming) return;
      try {
        const connection = peerConnectionRef.current;
        if (!connection) return;
        if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = window.setTimeout(() => {
          if (connection.connectionState !== "connected" && callRef.current?.callId === callId) {
            setCallError("Still connecting. Check your internet connection; restrictive networks may need a TURN relay.");
          }
        }, 15000);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        publishCall({ ...activeCall, status: "connecting" });
        socket.emit("call:offer", { callId, description: connection.localDescription });
      } catch (error) {
        setCallError(error.message || "Could not start the call.");
        endCall();
      }
    };
    const onPreparing = ({ callId }) => {
      const activeCall = callRef.current;
      if (!activeCall || activeCall.callId !== callId || activeCall.incoming) return;
      publishCall({ ...activeCall, status: "answering" });
    };
    const onOffer = async ({ callId, description }) => {
      const activeCall = callRef.current;
      const connection = peerConnectionRef.current;
      if (!activeCall || activeCall.callId !== callId || !activeCall.incoming || !connection) return;
      try {
        await connection.setRemoteDescription(description);
        for (const candidate of pendingCandidatesRef.current) await connection.addIceCandidate(candidate);
        pendingCandidatesRef.current = [];
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        socket.emit("call:answer", { callId, description: connection.localDescription });
      } catch (error) {
        setCallError(error.message || "Could not answer the call.");
        endCall();
      }
    };
    const onAnswer = async ({ callId, description }) => {
      const activeCall = callRef.current;
      const connection = peerConnectionRef.current;
      if (!activeCall || activeCall.callId !== callId || activeCall.incoming || !connection) return;
      try {
        await connection.setRemoteDescription(description);
        for (const candidate of pendingCandidatesRef.current) await connection.addIceCandidate(candidate);
        pendingCandidatesRef.current = [];
      } catch (error) {
        setCallError(error.message || "Could not establish the call.");
        endCall();
      }
    };
    const onCandidate = async ({ callId, candidate }) => {
      const activeCall = callRef.current;
      const connection = peerConnectionRef.current;
      if (!activeCall || activeCall.callId !== callId || !candidate) return;
      if (!connection?.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await connection.addIceCandidate(candidate);
      } catch (error) {
        setCallError(error.message || "A network candidate could not be added.");
      }
    };
    const onCallEnded = ({ callId, reason }) => {
      if (callRef.current?.callId !== callId) return;
      if (reason === "timeout") setCallError("No answer. The call invitation expired.");
      else if (reason === "busy") setCallError("This person is already on another call.");
      else if (reason === "disconnected") setCallError("The other person's connection was lost. The call has ended.");
      else if (reason === "declined") setCallError("The call was declined.");
      endCall(false);
    };
    const onCallRejected = ({ callId }) => {
      if (callRef.current?.callId !== callId) return;
      setCallError("The call was declined.");
      endCall(false);
    };
    const onDisconnect = () => {
      if (callRef.current) {
        setCallError("The live connection was lost. The call has ended.");
        endCall(false);
      }
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:preparing", onPreparing);
    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:candidate", onCandidate);
    socket.on("call:ended", onCallEnded);
    socket.on("call:rejected", onCallRejected);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:preparing", onPreparing);
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:candidate", onCandidate);
      socket.off("call:ended", onCallEnded);
      socket.off("call:rejected", onCallRejected);
      socket.off("disconnect", onDisconnect);
      if (callRef.current) endCall(false);
    };
  }, [endCall, publishCall, socket]);

  return {
    call,
    localStream,
    remoteStream,
    muted,
    cameraEnabled,
    quality,
    callError,
    clearCallError: () => setCallError(""),
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
