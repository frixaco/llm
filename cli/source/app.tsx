import React, {useState} from 'react';
import {Box, useApp, useInput} from 'ink';
import TextInput from 'ink-text-input';

export default function App() {
	const {exit} = useApp();
	const [query, setQuery] = useState('');

	useInput((input, key) => {
		if (input === 'q') {
			exit();
		}

		if (key.shift && key.return) {
			console.log('new line');
			setQuery(p => p + '\r\n');
		}
	});

	console.log(query);

	return (
		<Box marginRight={1} borderStyle="single" paddingX={1}>
			<TextInput value={query} onChange={setQuery} />
		</Box>
	);
}
