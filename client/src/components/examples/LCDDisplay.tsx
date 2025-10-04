import LCDDisplay from '../LCDDisplay';

export default function LCDDisplayExample() {
  return (
    <div className="p-8 bg-background">
      <LCDDisplay 
        mainText="PART 01  120 BPM" 
        subText="TRACK 01-08 ARMED"
        className="max-w-2xl"
      />
    </div>
  );
}
