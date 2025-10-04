import TrackButton from '../TrackButton';

export default function TrackButtonExample() {
  return (
    <div className="p-8 bg-background grid grid-cols-8 gap-1 max-w-4xl">
      <TrackButton trackNumber={1} selected />
      <TrackButton trackNumber={2} armed />
      <TrackButton trackNumber={3} playing />
      <TrackButton trackNumber={4} muted />
      <TrackButton trackNumber={5} />
      <TrackButton trackNumber={6} />
      <TrackButton trackNumber={7} />
      <TrackButton trackNumber={8} />
    </div>
  );
}
