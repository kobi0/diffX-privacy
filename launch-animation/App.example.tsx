// Example: show the Waka100 launch animation when the app starts, then switch
// to the rest of the app. Copy `src/` to `components/LaunchAnimation/` in your
// project, then adapt this to your own App.tsx.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LaunchAnimation } from './components/LaunchAnimation';

// Replace with your real start-up work: restoring the session, fetching config, ...
function loadApp() {
  return new Promise<void>((resolve) => setTimeout(resolve, 1500));
}

// Replace with your real app (navigation container, login screen, ...).
function MainApp() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Waka100</Text>
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showLaunch, setShowLaunch] = useState(true);

  useEffect(() => {
    loadApp().finally(() => setReady(true));
  }, []);

  if (showLaunch) {
    return (
      <LaunchAnimation
        ready={ready} // the shapes keep looping until this is true
        minCycles={2} // at least 2.4s of shapes before the reveal
        onDone={() => setShowLaunch(false)} // fires once the tagline has been shown
      />
    );
  }
  return <MainApp />;
}
