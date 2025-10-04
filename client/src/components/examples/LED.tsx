import LED from '../LED';

export default function LEDExample() {
  return (
    <div className="p-8 bg-background flex gap-4 items-center">
      <LED color="off" />
      <LED color="green" />
      <LED color="red" />
      <LED color="amber" />
      <LED color="orange" />
      <LED color="red" pulse />
    </div>
  );
}
