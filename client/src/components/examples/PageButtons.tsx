import PageButtons from '../PageButtons';

export default function PageButtonsExample() {
  return (
    <div className="p-8 bg-background">
      <PageButtons 
        onPageDown={() => console.log('Page Down')}
        onPageUp={() => console.log('Page Up')}
      />
    </div>
  );
}
