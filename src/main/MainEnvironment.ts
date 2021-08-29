import { Config } from "./Config"
import { MainApp } from "./MainApp"

export interface MainEnvironment {
	config: Config
	app: MainApp
}
