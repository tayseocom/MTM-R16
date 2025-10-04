import NumPad from '../NumPad';

export default function NumPadExample() {
  return (
    <div className="p-8 bg-background">
      <NumPad 
        onNumberClick={(num) => console.log('Number clicked:', num)}
        onMinusClick={() => console.log('Minus clicked')}
        className="max-w-xs"
      />
    </div>
  );
}
